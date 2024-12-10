import * as nano from 'nanocurrency';
import fetch from 'node-fetch';

// Configuration
const RPC_URL = "http://127.0.0.1:7076";
const seed = 'C75D686396BCAB6B4148485D7ACD7AABBD8E02F69D49F808CB7DFE12B23994E3';
const index = 0;

// Forward the received Balance to this Account
const FirstSendTo = 'nano_161wcu1gw14gge7tzxwbppnh8x64eu3xntzcxg6j5s8ph7je3i7wyd1xmt9s';


// Account details
const privateKey = nano.deriveSecretKey(seed, index);
const publicKey = nano.derivePublicKey(privateKey);
const address = nano.deriveAddress(publicKey);

// RPC helper function
async function callRPC(action, data) {
    debugger;  // Add breakpoint here to inspect RPC calls
    try {
        const response = await fetch(RPC_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action, ...data })
        });
        return await response.json();
    } catch (error) {
        console.error('RPC Error:', error);
        throw error;
    }
}

async function getAccountInfo() {
    console.log('\nChecking account info...');
    const accountInfo = await callRPC('account_info', { account: address });
    console.log('Account Info:', accountInfo);
    return accountInfo;
}

async function getReceivables() {
    const receivable = await callRPC('receivable', {
        account: address,
        source: 'true'
    });
    
    if (!receivable.blocks) return [];
    
    // Convert to array of objects with specific structure
    return Object.entries(receivable.blocks).map(([hash, data]) => {
        return {
            "hash": hash,
            "amount": data.amount,
            "source": data.source
        };
    });
}

async function processBlock(block, subtype) {
    console.log(`Processing ${subtype} block...`);
    const response = await callRPC('process', {
        json_block: 'true',
        subtype: subtype,
        block: block
    });
    
    if (response.error) {
        throw new Error(`Block processing failed: ${response.error}`);
    }
    
    console.log(`Block processed successfully. Hash: ${response.hash}`);
    return response;
}

async function createOpenBlock(receivableAmount, receivableHash) {
    console.log('\nCreating OPEN block...');
    debugger;  // Add breakpoint for block creation
    
    const previous = '0'.repeat(64);
    const pow = await nano.computeWork(publicKey);

    const block = {
        type: 'state',
        account: address,
        previous: previous,
        representative: address,
        balance: receivableAmount.toString(),
        link: receivableHash,
        work: pow
    };

    const signedBlock = nano.createBlock(privateKey, { ...block });
    console.log('Open Block created:', JSON.stringify(signedBlock.block, null, 2));
    
    const processed = await processBlock(signedBlock.block, 'open');
    return {
        hash: processed.hash,
        block: signedBlock.block
    };
}

async function createFirstSend(receiverAddress, previousHash, remaning_balance) {
    console.log('\nCreating SEND block...');
    debugger;  
    const pow = await nano.computeWork(previousHash, {
        workThreshold: 'fffffff800000000'
    });  

    const block = {
        type: 'state',
        account: address,
        previous: previousHash,
        representative: address,
        balance: remaning_balance.toString(), // 0 means that we sent the entire balance
        link: receiverAddress,
        work: pow
    };

    const signedBlock = snano.createBlock(privateKey, { ...block });
    console.log('Send Block created:', JSON.stringify(signedBlock.block, null, 2));
    
    const processed = await processBlock(signedBlock.block, 'send');
    return {
        hash: processed.hash,
        block: signedBlock.block
    };
}

async function main() {
    debugger;  // Initial breakpoint
    try {
        console.log('Starting Nano transaction flow...');
        console.log('Address:', address);
        console.log('Public Key:', publicKey);

        // Check account status
        let accountInfo = await getAccountInfo();
        const receivables = await getReceivables();

        // Create Open Block
        if (accountInfo.error === "Account not found") {
            console.log('Account not yet opened');
            
            if (receivables.length === 0) {
                console.log('No receivables found. Cannot open account without receivables.');
                return;
            }

            console.log('Opening account with first receivable:', receivables[0]);
            const openBlock = await createOpenBlock(receivables[0].amount, receivables[0].hash);
            console.log('Account opened successfully with hash:', openBlock.hash);            
            
        }

        // Forward entire balance
        accountInfo = await getAccountInfo();
        if (accountInfo.error === undefined)
        {
            console.log('Account exists with balance:', accountInfo.balance);
            const destination = FirstSendTo;
            // Send entire balance to destination account
            const sendBlock = await createFirstSend(destination, accountInfo.frontier, 0);
            console.log('Send completed with hash:', sendBlock.hash);
        }
    } catch (error) {
        console.error('Error in main flow:', error);
        throw error;
    }
}

// Execute the flow
main().catch(console.error);