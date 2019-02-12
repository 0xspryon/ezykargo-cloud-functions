import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import { Notifications } from '.';
const FieldValue = require('firebase-admin').firestore.FieldValue;

export class Referrals {

    /*
    *@cuts referral commissions.
    *-get referred user and update his referralcommission count,   
    *-update balance of ezykargo_balance in finances in statistics on rtdb
    *-Update balance of referrer and add referral transaction to his transactions collection.
    *-send notification to referrer about the referral transaction.
    */
    static cutReferralCommission = async (referredUserReference) => {
        return new Promise((resolve, reject) => {
            const firestore = admin.firestore()
            const db = admin.database()

            const userRef = firestore.doc(referredUserReference);
            const userSnapshot = await userRef.get()
            const { fullname } = userSnapshot.data()

            const userMoneyAccountRef = firestore.doc(`/bucket/moneyAccount/moneyAccounts/${userRef.id}`)
            const userMoneyAccountSnapshot = await userMoneyAccountRef.get()
            const { referrerRef, referralCommissionPrice, referralCommissionCount } = userMoneyAccountSnapshot.data()

            const referrerReference = firestore.doc(referrerRef)
            const referrerMoneyAccount = firestore.doc(`/bucket/moneyAccount/moneyAccounts/${referrerReference.id}`)
            const referrerMoneyAccountSnapshot = await userMoneyAccountRef.get()
            db.ref('z-platform/statistics/finances')
                .once('value', financesAccountSnapshot => {
                    if (financesAccountSnapshot.exists) {
                        const { ezykargo_balance } = financesAccountSnapshot.val()
                        financesAccountSnapshot.ref.set({ ezykargo_balance: -referralCommissionPrice + ezykargo_balance })
                    } else {
                        financesAccountSnapshot.ref.set({ ezykargo_balance: -referralCommissionPrice })
                    }
                })

            referrerMoneyAccount.collection('transactions').add({
                type: 'referral',
                amount: referralCommissionPrice,
                timestamp: FieldValue.serverTimestamp(),
            })
            const { balance } = referrerMoneyAccountSnapshot.data()
            referrerMoneyAccountSnapshot.ref.set({ balance: balance + referralCommissionPrice }, { merge: true })

            userMoneyAccountSnapshot.ref.set({ referralCommissionCount: referralCommissionCount + 1 }, { merge: true })
            Notifications.createGenericNotification(
                "Referral commission",
                "Commission de referencement",
                Referrals.messageBodyEn(referralCommissionPrice, fullname, referralCommissionCount),
                Referrals.messageBodyFr(referralCommissionPrice, fullname, referralCommissionCount),
                null,
                referrerRef
            )
                .then(ignored => resolve(true))
                .catch(ignored => reject())
        })
    }

    static messageBodyEn = (price, fullname, count) => `You've received ${price} CFA for having referred ${fullname}./n This is his ${count} transaction on Ezykargo`,

    static messageBodyFr = (price, fullname, count) => `Vous avez recu ${price} CFA pour avoir referrer ${fullname}./n Ceci lui fait ${count} transactions sur la plateform Ezykargo`,
}