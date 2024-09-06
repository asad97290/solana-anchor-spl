import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Spl } from "../target/types/spl";

describe("spl", () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.AnchorProvider.env());

  const program = anchor.workspace.Spl as Program<Spl>;

  it("Is initialized!", async () => {
    // Add your test here.
    const tx = await program.methods.initialize().rpc();
    console.log("Your transaction signature", tx);
  });

  describe("Test Minter", () => {
    // Metaplex Constants
    const METADATA_SEED = "metadata";
    const TOKEN_METADATA_PROGRAM_ID = program

    // Constants from our program
    const MINT_SEED = "mint";
  
    // Data for our tests
    const payer = anchor.wallet.publicKey;
    const metadata = {
      name: "Just a Test Token",
      symbol: "TEST",
      uri: "https://5vfxc4tr6xoy23qefqbj4qx2adzkzapneebanhcalf7myvn5gzja.arweave.net/7UtxcnH13Y1uBCwCnkL6APKsge0hAgacQFl-zFW9NlI",
      decimals: 9,
    };
    const mintAmount = 10;
    const [mint] = web3.PublicKey.findProgramAddressSync(
      [Buffer.from(MINT_SEED)],
      pg.PROGRAM_ID
    );

    const [metadataAddress] = web3.PublicKey.findProgramAddressSync(
      [
        Buffer.from(METADATA_SEED),
        TOKEN_METADATA_PROGRAM_ID.toBuffer(),
        mint.toBuffer(),
      ],
      TOKEN_METADATA_PROGRAM_ID
    );

    // Helper function to confirm transactions
    async function confirmTransaction(
        connection: web3.Connection,
        signature: web3.TransactionSignature,
        desiredConfirmationStatus: web3.TransactionConfirmationStatus = 'confirmed',
        timeout: number = 30000,
        pollInterval: number = 1000,
        searchTransactionHistory: boolean = false
    ): Promise<web3.SignatureStatus> {
        const start = Date.now();

        while (Date.now() - start < timeout) {
            const { value: statuses } = await connection.getSignatureStatuses([signature], { searchTransactionHistory });

            if (!statuses || statuses.length === 0) {
                throw new Error('Failed to get signature status');
            }

            const status = statuses[0];

            if (status === null) {
                await new Promise(resolve => setTimeout(resolve, pollInterval));
                continue;
            }

            if (status.err) {
                throw new Error(`Transaction failed: ${JSON.stringify(status.err)}`);
            }

            if (status.confirmationStatus && status.confirmationStatus === desiredConfirmationStatus) {
                return status;
            }

            if (status.confirmationStatus === 'finalized') {
                return status;
            }

            await new Promise(resolve => setTimeout(resolve, pollInterval));
        }

        throw new Error(`Transaction confirmation timeout after ${timeout}ms`);
    }
  
    it("initialize", async () => {

      const info = await pg.connection.getAccountInfo(mint);
      if (info) {
        return; // Do not attempt to initialize if already initialized
      }
      console.log("  Mint not found. Attempting to initialize.");
   
      const context = {
        metadata: metadataAddress,
        mint,
        payer,
        rent: web3.SYSVAR_RENT_PUBKEY,
        systemProgram: web3.SystemProgram.programId,
        tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
        tokenMetadataProgram: TOKEN_METADATA_PROGRAM_ID,
      };
  
      const txHash = await pg.program.methods
        .initToken(metadata)
        .accounts(context)
        .rpc();
  
      await confirmTransaction(pg.connection, txHash, 'finalized');
      console.log(`  https://explorer.solana.com/tx/${txHash}?cluster=devnet`);
      const newInfo = await pg.connection.getAccountInfo(mint);
      assert(newInfo, "  Mint should be initialized.");
    });
  
    it("mint tokens", async () => {

      const destination = await anchor.utils.token.associatedAddress({
        mint: mint,
        owner: payer,
      });
  
      let initialBalance: number;
      try {
        const balance = (await pg.connection.getTokenAccountBalance(destination))
        initialBalance = balance.value.uiAmount;
      } catch {
        // Token account not yet initiated has 0 balance
        initialBalance = 0;
      } 
      
      const context = {
        mint,
        destination,
        payer,
        rent: web3.SYSVAR_RENT_PUBKEY,
        systemProgram: web3.SystemProgram.programId,
        tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
        associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
      };
  
      const txHash = await pg.program.methods
        .mintTokens(new BN(mintAmount * 10 ** metadata.decimals))
        .accounts(context)
        .rpc();
      await confirmTransaction(pg.connection, txHash);
      console.log(`  https://explorer.solana.com/tx/${txHash}?cluster=devnet`);
  
      const postBalance = (
        await pg.connection.getTokenAccountBalance(destination)
      ).value.uiAmount;
      assert.equal(
        initialBalance + mintAmount,
        postBalance,
        "Post balance should equal initial plus mint amount"
      );
    });

  });


});
