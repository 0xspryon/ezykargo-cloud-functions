import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import { Freightages, Users } from '../models';
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
                    if (freightageData.bargainers && isArray(freightageData.bargainers)) {
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
        .onCreate(async (snapshot, context) => {
            const firestore = admin.firestore()
            const realtimeDatabase = admin.database()
            const freightageRef = context.params.freightageRef
            //const intentData = snapshot.after.val()
            const intentData = snapshot.val()
            console.log(intentData)
            firestore.doc(Freightages.getRef(freightageRef)).get()
                .then(freightageDataSnapshot => {
                    const { drivers } = intentData
                    freightageDataSnapshot.ref.set({
                        drivers: drivers.map((driver) => {
                            return {
                                driverRef: driver.userRef, price: driver.price, idle: true,
                                avatarUrl: driver.avatarUrl
                            }
                        }),
                        driversRefString: drivers.map((driver) => {
                            return driver.userRef
                        }),
                        idle: true,
                        inBargain: false,
                    }, { merge: true })
                        .then(() => {
                            realtimeDatabase.ref(`/intents/hire_drivers/${freightageRef}/response`).ref
                                .set({ code: 201 })
                        })
                        .catch((onrejected) => {
                            console.log("Reject 2", onrejected)
                            realtimeDatabase.ref(`/intents/hire_drivers/${freightageRef}/response`).ref
                                .set({ code: 500 })
                        })
                })
                .catch((onrejected) => {
                    console.log("Reject", onrejected)
                    realtimeDatabase.ref(`/intents/hire_drivers/${freightageRef}/response`).ref
                        .set({ code: 404 })
                })

        }
        )
    static listenPostResponseForHireDriver = functions.database.ref('/intents/{timestamp}/accepted_hired_request/{freightageRef}/{userRef}/accepted')
        .onCreate(async (snapshot, context) => {
            const firestore = admin.firestore()
            const realtimeDatabase = admin.database()

            const freightageRef = context.params.freightageRef
            const userRef = context.params.userRef
            const timestamp = context.params.timestamp

            const accepted = snapshot.val()
            console.log(accepted)
            firestore.doc(Freightages.getRef(freightageRef)).get()
                .then(freightageDataSnapshot => {
                    const freightageData = freightageDataSnapshot.data()
                    let driversRefStrings = freightageData.driversRefString || [];
                    let drivers = freightageData.drivers || [];
                    //check if driver is inside hired drivers
                    if (driversRefStrings.some(driversRefString => Users.getRef(userRef).indexOf(driversRefString)) === -1) {
                        realtimeDatabase.ref(`/intents/${timestamp}/accepted_hired_request/${freightageRef}/${userRef}/response`).ref
                            .set({ code: 401 })
                        return;
                    }
                    let selectedBargain;
                    drivers = drivers.map((driver) => {
                        if (Users.getRef(userRef).indexOf(driver.driverRef) !== -1) {
                            driver.idle = false
                            selectedBargain = driver
                        }
                        return driver;
                    });
                    //when user reject request
                    if (!accepted) {
                        driversRefStrings = driversRefStrings.filter((driver) => {
                            return Users.getRef(userRef).indexOf(driver) === -1;
                        })
                        freightageDataSnapshot.ref.set({
                            drivers: drivers,
                            driversRefString: driversRefStrings,
                            idle: true,
                            inBargain: false,
                        }, { merge: true })
                            .then(() => {
                                realtimeDatabase.ref(`/intents/${timestamp}/accepted_hired_request/${freightageRef}/${userRef}/response`).ref
                                    .set({ code: 200 })
                            })
                            .catch((onrejected) => {
                                console.log("Error on reject hire", onrejected)
                                realtimeDatabase.ref(`/intents/${timestamp}/accepted_hired_request/${freightageRef}/${userRef}/response`).ref
                                    .set({ code: 500 })
                            })
                    } else {
                        firestore.runTransaction(t => {
                            return t.get(firestore.doc(Users.getRef(userRef)))
                                .then(userDataSnapshot => {
                                    //check if someone already pickup 
                                    if (freightageData.pickup) {
                                        return realtimeDatabase.ref(`/intents/${timestamp}/accepted_hired_request/${freightageRef}/${userRef}/response`).ref
                                            .set({ code: 404 })
                                        // Promise.reject("404")
                                    } else {
                                        const driverDoc = userDataSnapshot.data()
                                        return freightageDataSnapshot.ref.set({
                                            drivers: drivers,
                                            idle: false,
                                            pickup: true,
                                            inBargain: false,
                                            amount: selectedBargain.price,
                                            driverRef: selectedBargain.driverRef,
                                            truckRef: driverDoc.truck.truckRef,
                                        }, { merge: true })
                                            .then(() => {
                                                realtimeDatabase.ref(`/intents/${timestamp}/accepted_hired_request/${freightageRef}/${userRef}/response`).ref
                                                    .set({ code: 201 })
                                            })
                                    }
                                })
                        })
                            .catch(err => {
                                console.log("Reject 2", err)
                                realtimeDatabase.ref(`/intents/${timestamp}/accepted_hired_request/${freightageRef}/${userRef}/response`).ref
                                    .set({ code: 500 })
                            })
                    }

                })
                .catch((onrejected) => {
                    console.log("Reject", onrejected)
                    realtimeDatabase.ref(`/intents/${timestamp}/accepted_hired_request/${freightageRef}/${userRef}/response`).ref
                        .set({ code: 404 })
                })

        });

}