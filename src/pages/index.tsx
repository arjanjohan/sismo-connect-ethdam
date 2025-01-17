import { switchNetwork, polygon, getPublicClient, handleVerifyErrors } from "@/utils";
import { createWalletClient, http, custom, WalletClient, PublicClient, parseEther } from "viem";
import { useAccount, useConnect, useDisconnect } from "wagmi";
import {
  SismoConnectButton,
  SismoConnectClientConfig,
  SismoConnectResponse,
  AuthType,
} from "@sismo-core/sismo-connect-react";
import axios from "axios";
import { useEffect, useState } from "react";
import { devGroups } from "../../config";
import { shieldTokens } from "../railgunCaller";

export const sismoConnectConfig: SismoConnectClientConfig = {
  // you can create a new Sismo Connect app at https://factory.sismo.io
  appId: "0xa4f0ae192a10871c403b3f971bba4291",
  devMode: {
    // enable or disable dev mode here to create development groups and use the development vault.
    enabled: true,
    devGroups: [devGroups[0]],
  },
};

type UserType = {
  id: string;
};

export enum APP_STATES {
  init,
  receivedProof,
  purchasing,
  success,
}

// The application calls contracts on Mumbai testnet
const userChain = polygon;
const contractAddress = "0xc7FfA542736321A3dd69246d73987566a5486968";
// TODO: Remplace with merchant address

export default function RegisterTwitterUser() {
  const [isReady, setIsReady] = useState(false);
  const [appState, setAppState] = useState<APP_STATES>(APP_STATES.init);
  const [loading, setLoading] = useState(false);
  const [responseBytes, setResponseBytes] = useState<string>("");

  const [contractError, setContractError] = useState<string>("");
  const [verifiedUser, setVerifiedUser] = useState<UserType>(null);
  const [walletClient, setWalletClient] = useState<WalletClient>(
    createWalletClient({
      chain: userChain,
      transport: http(),
    }) as WalletClient
  );

  const publicClient: PublicClient = getPublicClient(userChain);

  const { address, isConnected } = useAccount();
  const { connect, connectors, error, isLoading, pendingConnector } = useConnect();
  const { disconnect } = useDisconnect();

  //IT WONT PROMPT WALLET CONNECT but does retrieve connected wallet
  useEffect(() => {
    if (typeof window === "undefined") {
      console.log("UNDEFINED");
      return;
    }
    setWalletClient(
      createWalletClient({
        chain: userChain,
        transport: custom(window.ethereum, {
          key: " ",
        }),
      }) as WalletClient
    );
  }, [address]);

  // solves hydration errors with wagmi
  useEffect(() => setIsReady(true), []);
  if (!isReady) return null;

  async function verify(response: SismoConnectResponse) {
    // first we update the react state to show the loading state
    setLoading(true);

    try {
      console.log("response", response);
      // We send the response to our backend to verify the proof
      const res = await axios.post(`/api/verify-twitter-user`, {
        response,
      });

      const user = res.data;

      // If the proof is valid, we update the user react state to show the user profile
      setAppState(APP_STATES.receivedProof);
    } catch (e) {
      // Else if the proof is invalid, we show an error message
      // setError("Invalid response");
      console.error(e);
    } finally {
      // We set the loading state to false to show the user profile
      setLoading(false);
    }
  }

  async function buyWithSismo(responseBytes: string) {
    setAppState(APP_STATES.purchasing);
    // switch the network
    await switchNetwork(userChain);
    console.log(publicClient);
    console.log(walletClient);
    console.log(address); //TODO ITS EMPTY
    console.log(contractAddress);

    try {
      shieldTokens(window);
      // const txReceipt = await callContract({
      //   contractAddress,
      //   responseBytes,
      //   abi,
      //   userChain,
      //   address: address as `0x${string}`,
      //   publicClient,
      //   walletClient,
      // });
      // If the proof is valid, we update the user react state to show the tokenId
      setAppState(APP_STATES.success);
    } catch (e) {
      setContractError(handleVerifyErrors(e));
    } finally {
      setAppState(APP_STATES.init);
    }
  }

  return (
    <>
      <div className="container">
        {appState == APP_STATES.init && (
          <>
            {!isConnected && (
              <>
                <div>
                  {connectors.map((connector) => (
                    <button
                      disabled={!connector.ready}
                      key={connector.id}
                      onClick={() => {
                        connect({ connector });
                      }}
                      className="wallet-button"
                    >
                      Connect Wallet
                      {!connector.ready && "(unsupported)"}
                      {isLoading && connector.id === pendingConnector?.id && " (connecting)"}
                    </button>
                  ))}

                  {error && <div>{error.message}</div>}
                </div>
              </>
            )}
            {isConnected && (
              <>
                <h1>Anonymous purchase</h1>
                <p className="subtitle-page" style={{ marginBottom: 40 }}>
                  Connect with Twitter to access your wallet.
                </p>

                <SismoConnectButton
                  config={sismoConnectConfig}
                  auths={[{ authType: AuthType.TWITTER }]}
                  onResponse={(response: SismoConnectResponse) => verify(response)}
                  loading={loading}
                  text="Connect Twitter with Sismo"
                />
                <>{error}</>
              </>
            )}
          </>
        )}

        {/** Simple button to call the smart contract with the response as bytes */}
        {appState == APP_STATES.receivedProof && (
          <button
            className="wallet-button"
            onClick={async () => {
              await buyWithSismo(responseBytes);
            }}
            value="Pay now"
          >
            {"PAY NOW!"}
          </button>
        )}
        {appState == APP_STATES.purchasing && <p style={{ marginBottom: 40 }}>Buying...</p>}
        {/** Simple button to call the smart contract with the response as bytes */}
        {appState == APP_STATES.success && <p>{"SUCCESS"}</p>}
      </div>
    </>
  );
}
