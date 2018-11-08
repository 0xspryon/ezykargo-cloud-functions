import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import { File } from '../utils/File';
import { Freightages, Users } from '../models';
const FieldValue = require('firebase-admin').firestore.FieldValue;

export class FreightagesIntent {


    /***
     * @ creates a new freightage request on the platform.
     * -Doesn't verify validity of data in the freightage request as that will be done with security rules.
     * -construct freightage document.
     * -move item images from path to the final resting point and register in constructed freightage doc
     * -save freightage doc to freightage list .then increment freightagesCount appropriately.
     * -save response code 201 ok or any corresponding erro-code
     */
    static listenAddFreightageIntent = functions.database.ref('/intents/add_freightage/{timestamp}/{ref}/finished')
        .onCreate(async (snapshot, context) => {

            const realtimeDatabase = admin.database()
            const firestore = admin.firestore()

            const intentData = snapshot.val()
            console.log(intentData)
            if (!intentData) return false

            const ref = context.params.ref
            const timestamp = context.params.timestamp

            // const freightageDataSnapshot = await 
            return realtimeDatabase.ref(`/intents/add_freightage/${timestamp}/${ref}`).once(
                'value',
                freightageDataSnapshot => {

                    if (!freightageDataSnapshot.exists) {
                        console.log("Data doesn't exists")
                        realtimeDatabase.ref(`/intents/add_freightage/${timestamp}/${ref}`)
                            .ref.child("response")
                            .set({ code: 404 })
                        return false
                    }
                    const freightageData = freightageDataSnapshot.val()
                    console.log(freightageData)

                    const promises = []
                    const freightageDoc = {
                        ...freightageData,
                        arrival_date: +freightageData.arrival_date,
                        departure_date: +freightageData.departure_date,
                        departure_time: freightageData.departure_time,
                        car_pool_number: (freightageData.car_pool) ? +freightageData.car_pool_number : 0,
                        volume: +freightageData.volume,
                        weight: +freightageData.weight,
                        image: "",
                        items: [],
                        drivers: [],
                        bargainers: [],
                        createdAt: FieldValue.serverTimestamp(),
                        updatedAt: FieldValue.serverTimestamp(),
                        isDeleted: false,
                        onTransit: false,
                        delivered: false,
                        completed: false,
                        idle: false,
                        inBargain: true,
                        pickup: false,
                        relayCount: 0
                    }
                    console.log(freightageDoc)
                    const uid = freightageData.userRef.split("/").pop()
                    const { items } = freightageData
                    const keys = Object.keys(items)
                    keys.forEach(key => {
                        const item = items[key]
                        const imagePath = item.imagePath
                        const newImagePath = `/freightages/${uid}/${imagePath.split("/").pop()}`
                        if ( !freightageDoc.image || freightageDoc.image === "" ) freightageDoc.image = newImagePath
                        freightageDoc.items.push({ ...item, imagePath: newImagePath, quantity: +item.quantity, weight: +item.weight })
                        promises.push(File.moveFileFromTo(imagePath, newImagePath))
                    });

                    const freightageRef = firestore.collection(Freightages.basePath).doc()
                    const freightagesList = firestore.doc(Freightages.bucketPath)
                    promises.push(new Promise((resolve, reject) => {
                        freightageRef.set(freightageDoc).then(() => {
                            freightagesList.get()
                                .then(freightagesListSnapshot => {
                                    let freightagesCount = 0;
                                    if (freightagesListSnapshot.exists) freightagesCount = freightagesListSnapshot.get("freightagesCount")
                                    freightagesCount = +freightagesCount + 1
                                    // console.log({ freightagesCount : freightagesListSnapshot.get("freightagesCount"), data: freightagesListSnapshot.data()})
                                    freightagesList.set({ freightagesCount }, { merge: true })
                                        .then(() => {
                                            realtimeDatabase.ref(`/intents/add_freightage/${timestamp}/${ref}`).ref.child("response")
                                                .set({ code: 201 }).then(() => {
                                                    resolve(true)
                                                }).catch((err) => {
                                                    reject(err)
                                                })
                                        })
                                })
                        }).catch((err) => {
                            reject(err)
                        })
                    }).catch((err) => {
                        console.log(err)
                        realtimeDatabase.ref(`/intents/add_freightage/${timestamp}/${ref}`)
                            .ref.child("response")
                            .set({ code: 500 })
                    }))

                    return Promise.all(promises)
                })

        }
    );
    
    static listenMarkAsPickup = functions.database.ref('/intents/{timestamp}/mark_as_pickup/{ref}')
        .onCreate(async (snapshot, context) => {
            const firestore = admin.firestore()
            const realtimeDatabase = admin.database()

            const ref = context.params.ref
            const timestamp = context.params.timestamp

            const data = snapshot.val()


            firestore.doc(data["userRef"]).get()
                .then(userDataSnapshot => {
                const userData = userDataSnapshot.data()
                if(userData['transaction_pin_code'] !== ""+ data["password"]){
                    realtimeDatabase.ref(`/intents/${timestamp}/mark_as_pickup/${ref}/response`).ref
                        .set({ code: 403 })
                    return;
                }
                firestore.doc(data["freightageRef"]).get()
                    .then(freightageDataSnapshot => {
                        const freightageData = freightageDataSnapshot.data()
                        
                        if(freightageData['driverRef'] !== ""+ data["userRef"]){
                            realtimeDatabase.ref(`/intents/${timestamp}/mark_as_pickup/${ref}/response`).ref
                                .set({ code: 401 })
                            return;
                        }
                        freightageDataSnapshot.ref.set({
                            onTransit: true,
                            pickup: false,
                        }, { merge: true })
                        .then(() => {
                            realtimeDatabase.ref(`/intents/${timestamp}/mark_as_pickup/${ref}/response`).ref
                                .set({ code: 200 })
                        })
                        .catch((onrejected) => {
                            console.log("Error on reject hire", onrejected)
                            realtimeDatabase.ref(`/intents/${timestamp}/mark_as_pickup/${ref}/response`).ref
                                .set({ code: 500 })
                        })
                        
                    })
                    .catch((onrejected) => {
                        console.log("Reject", onrejected)
                        realtimeDatabase.ref(`/intents/${timestamp}/mark_as_pickup/${ref}/response`).ref
                            .set({ code: 404 })
                    })
                })
                .catch((onrejected) => {
                    console.log("Reject", onrejected)
                    realtimeDatabase.ref(`/intents/${timestamp}/mark_as_pickup/${ref}/response`).ref
                        .set({ code: 404 })
                })

        });



        static listenMarkAsDelivered = functions.database.ref('/intents/{timestamp}/mark_as_delivered/{ref}')
        .onCreate(async (snapshot, context) => {
            const firestore = admin.firestore()
            const realtimeDatabase = admin.database()

            const ref = context.params.ref
            const timestamp = context.params.timestamp

            const data = snapshot.val()


            firestore.doc(data["userRef"]).get()
                .then(userDataSnapshot => {
                const userData = userDataSnapshot.data()
                if(userData['transaction_pin_code'] !== ""+ data["password"]){
                    realtimeDatabase.ref(`/intents/${timestamp}/mark_as_delivered/${ref}/response`).ref
                        .set({ code: 403 })
                    return;
                }
                firestore.doc(data["freightageRef"]).get()
                    .then(freightageDataSnapshot => {
                        const freightageData = freightageDataSnapshot.data()
                        
                        if(freightageData['driverRef'] !== ""+ data["userRef"]){
                            realtimeDatabase.ref(`/intents/${timestamp}/mark_as_delivered/${ref}/response`).ref
                                .set({ code: 401 })
                            return;
                        }
                        freightageDataSnapshot.ref.set({
                            onTransit: true,
                            pickup: false,
                        }, { merge: true })
                        .then(() => {
                            realtimeDatabase.ref(`/intents/${timestamp}/mark_as_delivered/${ref}/response`).ref
                                .set({ code: 200 })
                        })
                        .catch((onrejected) => {
                            console.log("Error on reject hire", onrejected)
                            realtimeDatabase.ref(`/intents/${timestamp}/mark_as_delivered/${ref}/response`).ref
                                .set({ code: 500 })
                        })
                        
                    })
                    .catch((onrejected) => {
                        console.log("Reject", onrejected)
                        realtimeDatabase.ref(`/intents/${timestamp}/mark_as_delivered/${ref}/response`).ref
                            .set({ code: 404 })
                    })
                })
                .catch((onrejected) => {
                    console.log("Reject", onrejected)
                    realtimeDatabase.ref(`/intents/${timestamp}/mark_as_delivered/${ref}/response`).ref
                        .set({ code: 404 })
                })

        });

}