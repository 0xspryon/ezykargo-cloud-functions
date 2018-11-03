import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import { Freightages } from '../models';
import { isArray } from 'util';

export class BargainsIntent {
    
    static listenAddBargainerOnRTDB = functions.database.ref('bargain/{freightageRef}/participants/{userRef}')
        .onCreate(async (snapshot, context) => {
            const firestore = admin.firestore()

            const freightageRef = context.params.freightageRef
            const userRef = context.params.userRef

            firestore.doc(Freightages.getRef(freightageRef)).get()
                .then(freightageDataSnapshot => {
                    const freightageData = freightageDataSnapshot.data()
                    let bargainers = [];
                    if(freightageData.bargainers && isArray(freightageData.bargainers)){
                        bargainers = freightageData.bargainers;
                    }
                    bargainers.push(userRef)
                    freightageDataSnapshot.ref.set({
                        bargainers: bargainers
                    }, { merge: true })
                        .catch((onrejected) => {
                            console.log("Reject 2", onrejected)
                        })
                })
                .catch((onrejected) => {
                    console.log("Reject", onrejected)
                })

        }
    )

    static listenHireDriversOnRTDB = functions.database.ref('/intents/hire_drivers/{freightageRef}')
        .onUpdate(async (snapshot, context) => {
            const firestore = admin.firestore()
            const realtimeDatabase = admin.database()
            const freightageRef = context.params.freightageRef
            const intentData = snapshot.after.val()
            console.log(intentData)
            firestore.doc(Freightages.getRef(freightageRef)).get()
                .then(freightageDataSnapshot => {
                    const { drivers } = intentData
                    freightageDataSnapshot.ref.set({
                        drivers: drivers.map((driver)=>{
                            return {driverRef: driver.userRef,price: driver.price,idle: true}
                        }),
                        idle: true,
                        inBargain: false,
                    }, { merge: true })
                    .then(() => {
                        realtimeDatabase.ref(`/intents/hire_drivers/${freightageRef}`).ref.child("response")
                            .set({ code: 201 }).then(() => {
                            }).catch((err) => {
                            })
                    })
                    .catch((onrejected) => {
                        console.log("Reject 2", onrejected)
                        realtimeDatabase.ref(`/intents/hire_drivers/${freightageRef}`).ref.child("response")
                            .set({ code: 500 }).then(() => {
                            })
                    })
                })
                .catch((onrejected) => {
                    console.log("Reject", onrejected)
                    realtimeDatabase.ref(`/intents/hire_drivers/${freightageRef}`).ref.child("response")
                        .set({ code: 500 }).then(() => {
                        })
                })

        }
    )

}