const admin = require('firebase-admin');
const nodemailer = require('nodemailer');

require('dotenv').config();

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

console.log("🔐 Using Firebase project ID:", serviceAccount.project_id);


const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
});

async function checkVaultUnlocks() {
    const now = admin.firestore.Timestamp.now();

    let userID = '';
    let vaultId = '';

    try
    {
        const usersSnapshot = await db.collection('USERS').get();
        
        console.log(`🧪 USERS count: ${usersSnapshot.size}`);

        for(const userDoc of usersSnapshot.docs)
        {
            userID = userDoc.id;

            const vaultsSnapshot = await db 
            .collection('USERS')
            .doc(userID)
            .collection('Vaults')
            .where('unlocked','==',false)
            .get();

            console.log(`🔐 User ${userID} has ${vaultsSnapshot.size} locked vault(s).`);

            for(const vaultDoc of vaultsSnapshot.docs)
            {
                const vaultData = vaultDoc.data();
                vaultId = vaultDoc.id;

                const vaultname = vaultData.vaultname

                console.log(`🔍 Checking vault ${vaultId} for user ${userID}`);

                console.log(`unlockTime: ${vaultData.unlockTime?.toDate()}, now: ${now.toDate()}`);

                if(vaultData.unlockTime && vaultData.unlockTime.toMillis() <= now.toMillis())
                {
                    console.log("⏰ Vault should now be unlocked!");

                    await db
                    .collection('USERS')
                    .doc(userID)
                    .collection('Vaults')
                    .doc(vaultId)
                    .update({ unlocked: true,
                        status:'Unlocked'
                    });

                    // const mailOptions = {
                    //     from: `"Time Vault" <${process.env.EMAIL_USER}>`,
                    //     to: vaultData.emailrecipent,
                    //     subject: 'Your Vault is Unlocked!',
                    //     html: `
                    //         <p>Hi There,</p>
                    //         <p>Your vault <strong>${vaultname}</strong> has just been unlocked.</p>
                    //         <p>
                    //             <a href="vaultapp://vault?uid=${userID}&vid=${vaultId}" 
                    //             style="color: #1a73e8; text-decoration: underline;">
                    //             🔓 Open Vault in App
                    //             </a>
                    //         </p>
                    //         <p>If the link doesn't work, open the TimeVault app manually.</p>
                    //         <p><em>Thank you for using TimeVault!</em></p>
                    //         `,
                    // };


                    const mailOptions = {
                                        from: `"Time Vault" <${process.env.EMAIL_USER}>`,
                                        replyTo: process.env.EMAIL_USER,
                                        to: vaultData.emailrecipent,
                                        subject: 'Your Vault is Unlocked!',
                                        messageId: `<vault-${vaultId}@timevault.local>`,
                                        text: `Hi There,\nYour vault ${vaultId} has just been unlocked.\n\nOpen Vault: vaultapp://vault?uid=${userID}&vid=${vaultId}\n\nThank you for using TimeVault!`,
                                        html: `
                                            <p>Hi There,</p>
                                            <p>Your vault <strong>${vaultId}</strong> has just been unlocked.</p>
                                            <p>
                                                <a href="https://alok-kumar2024.github.io/Vault-Web/vault.html?userId=${userID}&vaultId=${vaultId}" 
                                                style="color: #1a73e8; text-decoration: underline;">
                                                🔓 Open Vault in App
                                                </a>
                                            </p>
                                            <p>If the link doesn't work, open the TimeVault app manually.</p>
                                            <p><em>Thank you for using TimeVault!</em></p>
                                        `,
                                    };

                    await transporter.sendMail(mailOptions)
                    .then(() => console.log("📧 Email sent"))
                    .catch(err => console.error("❌ Email error", err));

                    console.log(`✅ Vault ${vaultId} unlocked and email send to ${vaultData.emailrecipent}`);

                    const userDocSnap = await db.collection('USERS').doc(userID).get()
                    const fcmToken = userDocSnap.data().fcmToken;

                    const notificationId = `${userID}_${vaultId}_${Date.now()}`
                    if(fcmToken)
                    {
                        const message = {
                            token: fcmToken,
                            data: {
                                vaultname: String(vaultname),
                                title: 'Vault Unlocked!!',
                                body: `Your Vault ${vaultname} is now unlocked.`,
                                notificationId: String(notificationId)
                            },
                        };

                        await admin.messaging().send(message)
                        .then(() => console.log(`📲 FCM sent to ${userID}`))
                        .catch(err =>console.error("❌ FCM error", err))
                    }else{
                         console.log(`🚫 No FCM token for user ${userID}`);
                    }

                
                }
            }
        }
           console.log('✅ Vault check complete');
    }catch(error)
    {
        console.error(`❌ Failed to process vault ${vaultId || 'N/A'} for user ${userID || 'N/A'}:`, error);
    }
    
}


checkVaultUnlocks();

