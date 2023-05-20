import {
  Chain,
  PublicClient,
  WalletClient,
  createPublicClient,
  createWalletClient,
  encodeAbiParameters,
  http,
  parseEther,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { TransactionReceipt as ViemTransactionReceipt } from "viem";

declare global {
  interface Window {
    ethereum?: any;
  }
}
// import dotenv from "dotenv";

// dotenv.config();

export type TransactionReceipt = ViemTransactionReceipt & {
  logs: ViemTransactionReceipt["logs"] & { topics: string[] }[];
};

export const mumbaiFork = {
  id: 5151110,
  name: "Fork Mumbai - Sismo",
  network: "forkMumbaiSismo",
  nativeCurrency: { name: "MATIC", symbol: "MATIC", decimals: 18 },
  rpcUrls: {
    default: {
      http: ["http://127.0.0.1:8545"],
    },
    public: {
      http: ["http://127.0.0.1:8545"],
    },
  },
} as const satisfies Chain;


export const goerli = {
  id: 5,
  name: "Goerli",
  network: "goerli",
  nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: {
      http: ["https://goerli.infura.io/v3/3eb18f8fb50f4d44b0747060cefabcbf"],
    },
    public: {
      http: ["https://goerli.infura.io/v3/3eb18f8fb50f4d44b0747060cefabcbf"],
    },
  },
} as const satisfies Chain;

export const getPublicClient = (userChain: Chain): PublicClient => {
  return createPublicClient({
    chain: userChain,
    transport: http(),
  });
};

export const publicWalletClient = createWalletClient({
  chain: mumbaiFork,
  transport: http(),
  // The private key of the second account of the local anvil network
  // This account is used for the app to allow the user to have fake tokens to call the contract
  account: privateKeyToAccount(
    "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d"
  ),
});

export const switchNetwork = async (userChain: Chain) => {
  if (typeof window === "undefined") return;
  try {
    await window.ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: `0x${userChain.id.toString(16)}` }],
    });
  } catch (error: any) {
    // This error code means that the chain we want has not been added to MetaMask
    // In this case we ask the user to add it to their MetaMask
    if (error.code === 4902) {
      try {
        // add mumbai fork chain to metamask
        await window.ethereum.request({
          method: "wallet_addEthereumChain",
          params: [
            {
              chainId: `0x${userChain.id.toString(16)}`,
              chainName: userChain.name,
              rpcUrls: userChain.rpcUrls.default.http,
              nativeCurrency: {
                name: userChain.nativeCurrency.name,
                symbol: userChain.nativeCurrency.symbol,
                decimals: userChain.nativeCurrency.decimals,
              },
            },
          ],
        });
      } catch (error) {
        console.log(error);
      }
    } else {
      console.log(error);
    }
  }
};

export const callContract = async ({
  contractAddress,
  responseBytes,
  abi,
  userChain,
  address,
  publicClient,
  walletClient,
}: {
  contractAddress: string;
  responseBytes: string;
  abi: any;
  userChain: Chain;
  address: `0x${string}`;
  publicClient: PublicClient;
  walletClient: WalletClient;
}): Promise<string> => {
  const txArgs = {
    address: contractAddress as `0x${string}`,
    abi: abi,
    functionName: "mintPrice", // TODO: Change it to functionName of railgun SC
    args: [],
    account: address,
    chain: userChain,
  };

  // simulate the call to the contract to get the error if the call reverts
  await publicClient.simulateContract(txArgs);
  // if the simulation call does not revert, send the tx to the contract
  const txHash = await walletClient.writeContract(txArgs);
  // wait for the tx to be mined
  const receipt = (await publicClient.waitForTransactionReceipt({
    hash: txHash,
  })) as TransactionReceipt;

  // Check that there is at least one log before trying to access it
  if (receipt.logs.length > 0) {
    const tokenId = receipt.logs[0].topics[3];
    return tokenId;
  }
};

export const signMessage = (address: `0x${string}` | undefined) => {
  return encodeAbiParameters(
    [{ type: "address", name: "airdropAddress" }],
    [address as `0x${string}`]
  );
};

export function handleVerifyErrors(e: any): any {
  // else if the tx is invalid, we show an error message
  // it is either because the proof is invalid or because the user already claimed the airdrop
  console.log("error", { ...(e as object) });
  console.log("e.shortMessage", (e as { shortMessage: string }).shortMessage);
  let returnedError: string = (e as { shortMessage: string }).shortMessage;
  if (
    (e as { shortMessage: string }).shortMessage ===
    'The contract function "claimWithSismo" reverted with the following reason:\nERC721: transfer caller is not owner nor approved' ||
    (e as { shortMessage: string }).shortMessage ===
    'The contract function "claimWithSismo" reverted with the following reason:\nERC721: token already minted'
  ) {
    returnedError = "Airdrop already claimed!";
  }

  if (
    (e as { shortMessage: string }).shortMessage ===
    'Encoded error signature "0x587110c0" not found on ABI.\nMake sure you are using the correct ABI and that the error exists on it.\nYou can look up the signature here: https://openchain.xyz/signatures?query=0x587110c0.'
  ) {
    returnedError =
      "The address used to claim the airdrop is different from the one that has been signed in the user Vault.\nClick on the 'Back Home' button on the top left to retry the process.";
  }

  if (
    (e as { shortMessage: string }).shortMessage ===
    'Encoded error signature "0x2a2172c9" not found on ABI.\nMake sure you are using the correct ABI and that the error exists on it.\nYou can look up the signature here: https://openchain.xyz/signatures?query=0x2a2172c9.'
  ) {
    returnedError =
      "The registry root is not the same in the proof and in the AvailableRegistryRoot contract. Please relaunch the frontend and try again. If you experiment this error again, please contact us on Telegram https://t.me/+Z-SwcvXZFRVhZTQ0.";
  }
  return returnedError;
}
