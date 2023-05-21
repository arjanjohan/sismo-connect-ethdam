import { ethers } from "ethers";
import { polygon } from "@/utils";
import {
  startRailgunEngine,
  StartRailgunEngineResponse,
  populateShield,
  getShieldPrivateKeySignatureMessage,
  gasEstimateForShield,
} from "@railgun-community/quickstart";
import {
  RailgunERC20AmountRecipient,
  TransactionGasDetailsSerialized,
  NetworkName,
  EVMGasType,
  deserializeTransaction,
} from "@railgun-community/shared-models";

import { ArtifactStore } from '@railgun-community/quickstart';
import localforage from 'localforage';
import LevelDB from 'level-js';


const initialize = (): StartRailgunEngineResponse => {

  // Name for your wallet implementation.
  // Encrypted and viewable in private transaction history.
  // Maximum of 16 characters, lowercase.
  const walletSource = 'quickstart demo';

  // LevelDOWN compatible database for storing encrypted wallets.
  const db = new LevelDB("database_wallets");

  // Whether to forward Engine debug logs to Logger.
  const shouldDebug = true;

  // Persistent store for downloading large artifact files.
  // See Quickstart Developer Guide for platform implementations.
  const artifactStore = new ArtifactStore(
    async (path: string) => {
      return localforage.getItem(path);
    },
    async (dir: string, path: string, item: string | Buffer) => {
      await localforage.setItem(path, item);
    },
    async (path: string) => (await localforage.getItem(path)) != null,
  );
  // Whether to download native C++ or web-assembly artifacts.
  // True for mobile. False for nodejs and browser.
  const useNativeArtifacts = false;

  // Whether to skip merkletree syncs and private balance scans. 
  // Only set to TRUE in shield-only applications that don't 
  //  load private wallets or balances.
  const skipMerkletreeScans = false;

  return startRailgunEngine(
    walletSource,
    db,
    shouldDebug,
    artifactStore,
    useNativeArtifacts,
    skipMerkletreeScans,
  )
}

export async function shieldTokens(window: Window) {
  initialize()
  console.log("StartRailgunEngineResponse")
  console.log(StartRailgunEngineResponse)
  // The provider would come from your Web3 connection.
  const provider = new ethers.providers.Web3Provider(window.ethereum);
  console.log("We have a provider");
  // Get signer - this is the wallet that is currently connected.
  const signer = provider.getSigner();
  console.log("We have a signer");

  const erc20AmountRecipients: RailgunERC20AmountRecipient[] = [
    {
      tokenAddress: "0x0000000000000000000000000000000000001010", // MATIC
      amountString: "0x10", // hexadecimal amount
      recipientAddress:
        "0zk1qy427vqjydgrm0nuz70dpwk9xqu6q6gz96h7nwgmmuc488qkqcefdrv7j6fe3z53l77mapfxzfnpac37jwst85676382snn0pe3xn6phtzchsms90mtzxfqq9ah", // RAILGUN address
    },
  ];

  const shieldSignatureMessage = getShieldPrivateKeySignatureMessage();
  const shieldPrivateKey = ethers.utils.keccak256(await signer.signMessage(shieldSignatureMessage));
  console.log("We have a shield");

  const { gasEstimateString } = await gasEstimateForShield(
    NetworkName.Polygon,
    shieldPrivateKey,
    erc20AmountRecipients,
    [], // nftAmountRecipients
    await signer.getAddress()
  );

  console.log("We have a gas estimate");

  const gasDetailsSerialized: TransactionGasDetailsSerialized = {
    evmGasType: EVMGasType.Type2, // Depends on the chain (BNB uses type 0)
    gasEstimateString,
    maxFeePerGasString: "0x100000", // Current gas Max Fee
    maxPriorityFeePerGasString: "0x010000", // Current gas Max Priority Fee
  };

  console.log("gas details")
  const { serializedTransaction, error } = await populateShield(
    NetworkName.Polygon,
    shieldPrivateKey,
    erc20AmountRecipients,
    [], // nftAmountRecipients
    gasDetailsSerialized
  );
  if (error) {
    // Handle populate transaction error.
    console.log(error);
    return;
  }
  console.log("serialized")

  const chain = polygon;

  const transactionRequest = deserializeTransaction(
    serializedTransaction,
    undefined, // nonce (optional)
    chain.id
  );

  console.log("Transaction request " + transactionRequest);

  const transactionResponse = await signer.sendTransaction(transactionRequest);
  console.log("after transactionResponse");
  const transactionReceipt = await transactionResponse.wait();

  console.log(transactionReceipt.transactionHash);
}

// Then you could use this function as an onClick handler, like:
// <button onClick={shieldTokens}>Shield Tokens</button>
