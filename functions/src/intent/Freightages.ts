import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import { File } from '../utils/File';
import { Freightages } from '../models';
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
                    //check if data is correct
                    // const response = await Freightages.isValidFreightage(freightageData) ;
                    // if (response !== true){
                    //     // format response and put into rtdb
                    //     realtimeDatabase.ref(`/intents/add_freightage/${timestamp}/${ref}`).ref.child("response")
                    //         .set({code: response})
                    //     return false
                    // }

                    const promises = []
                    const freightageDoc = {
                        ...freightageData,
                        arrival_date: +freightageData.arrival_date,
                        // arrival_time: freightageData.arrival_time,
                        // car_pool: freightageData.car_pool,
                        // description: freightageData.description,
                        // from: freightageData.from,
                        // to: freightageData.to,
                        // userRef: freightageData.userRef,
                        departure_date: +freightageData.departure_date,
                        departure_time: freightageData.departure_time,
                        car_pool_number: (freightageData.car_pool) ? +freightageData.car_pool_number : 0,
                        volume: +freightageData.volume,
                        weight: +freightageData.weight,
                        image: "",
                        items: [],
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
    )


}