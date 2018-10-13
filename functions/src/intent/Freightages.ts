import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import {File} from '../utils/File';
import {  Freightages } from '../models';
const FieldValue = require('firebase-admin').firestore.FieldValue;

export class FreightagesIntent {


    static listenAddFreightageIntent = functions.database.ref('/intents/add_freightage/{timestamp}/{ref}/finished')
        .onCreate(async (snapshot,context)=>{
            console.log(snapshot.val())
            if(!snapshot.val())
                return false
            const ref = context.params.ref
            const timestamp = context.params.timestamp

            const freightageDataSnapshot = await admin.database().ref(`/intents/add_freightage/${timestamp}/${ref}`).once('value')
            const freightageData = freightageDataSnapshot.val()
            //check if data is correct
            const response = await Freightages.isValidFreightage(freightageData) ;
            if (response !== true){
                // format response and put into rtdb
                admin.database().ref(`/intents/add_freightage/${timestamp}/${ref}`).ref.child("response")
                    .set({code: response})
                return false
            }
            //create new freightage doc to store into firestore
            const promises = []
            const freightageDoc = {
                arrival_date:  +freightageData.arrival_date,
                arrival_time: freightageData.arrival_time,
                departure_date: +freightageData.departure_date,
                departure_time: freightageData.departure_time,
                car_pool: freightageData.car_pool,
                car_pool_number: (freightageData.car_pool)? +freightageData.car_pool_number : 0 ,
                description: freightageData.description,
                from: freightageData.from,
                to:  freightageData.to,
                userRef: freightageData.userRef,
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
            const uid = freightageDoc.userRef.split("/").pop()
            console.log("ici")
            Object.keys(freightageData.items).forEach(elt => {
                const item = freightageData.items[elt]
                const imagePath = item.imagePath
                const newImagePath = `/freightages/${uid}/${imagePath.split("/").pop()}`
                if(freightageDoc.image==="")
                    freightageDoc.image = newImagePath
                freightageDoc.items.push({
                    imagePath: newImagePath,
                    name: item.name,
                    package_type: item.package_type,
                    quantity: +item.quantity,
                    weight: +item.weight,
                    unity_name: item.unity_name,
                })
                promises.push(File.moveFileFromTo(imagePath,newImagePath))
            });
            const freightageRef = admin.firestore().collection(Freightages.basePath).doc()
            promises.push(
                freightageRef.set(freightageDoc).then(()=> {
                    return admin.firestore().runTransaction(t=>{
                        console.log("ici")
                        const refFreightages = admin.firestore().doc(Freightages.bucketPath)
                        console.log(refFreightages)
                        console.log("la")
                        return t.get(refFreightages).then((freightageListSnaphsot)=>{
                            console.log("ici là")
                            const count = freightageListSnaphsot.data().freightagesCount + 1
                            console.log("ici là")
                            return t.update(refFreightages,{freightagesCount: count})
                        })
                    }).then((onfullfilled)=>{
                        return admin.database().ref(`/intents/add_freightage/${timestamp}/${ref}`).ref.child("response")
                            .set({code: 201})
                    })
                })
            )

            Promise.all(promises).catch((err)=>{
                console.log(err)
                admin.database().ref(`/intents/add_freightage/${timestamp}/${ref}`)
                    .ref.child("response")
                    .set({code: 500})
            })
        })
    
}