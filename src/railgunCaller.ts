import { ethers } from "ethers";
import { polygon } from "@/utils";
import {
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

export async function shieldTokens(window: Window) {
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

  const { gasEstimateString } = await gasEstimateForShield(
    NetworkName.Polygon,
    shieldPrivateKey,
    erc20AmountRecipients,
    [], // nftAmountRecipients
    await signer.getAddress()
  );

  const gasDetailsSerialized: TransactionGasDetailsSerialized = {
    evmGasType: EVMGasType.Type2, // Depends on the chain (BNB uses type 0)
    gasEstimateString,
    maxFeePerGasString: "0x100000", // Current gas Max Fee
    maxPriorityFeePerGasString: "0x010000", // Current gas Max Priority Fee
  };

  const { serializedTransaction, error } = await populateShield(
    NetworkName.Polygon,
    shieldPrivateKey,
    erc20AmountRecipients,
    [], // nftAmountRecipients
    gasDetailsSerialized
  );
  if (error) {
    // Handle populate transaction error.
    return;
  }

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
