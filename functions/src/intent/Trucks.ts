import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import {File} from '../utils/File';
import { Users, Trucks } from '../models';
const FieldValue = require('firebase-admin').firestore.FieldValue;

export class TrucksIntent {

    static listenAddTruckIntent = functions.database.ref('/intents/add_truck/{uid}/{ref}/finished')
        .onUpdate(async (change,context)=>{
            const snapshot = change.after
            if(!snapshot.val())
                return false
            const uid = context.params.uid
            const ref = context.params.ref

            const truckDataSnapshot = await admin.database().ref(`/intents/add_truck/${uid}/${ref}`).once('value')
            const truckData = truckDataSnapshot.val()
            console.log(truckData)
            //check if data is correct
            if (!Trucks.isValidTruck(truckData))
                // format response and put into rtdb
                return false
            //create new truck doc to store into firestore
            const promises = []
            const truckDoc = {
                make: truckData.make,
                model: truckData.model,
                maximunWeight: truckData.maximunWeight,
                numberOfTyres: truckData.numberOfTyres,
                volume: truckData.volume,
                immatriculation: truckData.immatriculation,
                commonName: truckData.commonName,
                age: truckData.age,
                numberOfPreviousDrivers: 0,
                owner_uid: Users.getRef(uid),
                driver_uid: Users.getRef(truckData.driver_uid),
                createdAt: FieldValue.serverTimestamp(),
                updatedAt: FieldValue.serverTimestamp(),
                isDeleted: false
            }
            console.log(truckDoc)
            //foreach all images and push it move it to another location
            truckData.images.forEach(currentItem => {
                 promises.push(File.moveFileFromTo(currentItem.path,`/trucks/${uid}/${currentItem.path.split("/").pop()}`))
            })
            
            promises.push( async () =>{
                const truckRef = await admin.firestore().collection(Trucks.basePath).add(truckDoc)
                const subPromises = []
                truckData.images.forEach(currentItem => {
                    subPromises.push(
                        truckRef.collection("images").add({
                            url: `/trucks/${uid}/${currentItem.path.split("/").pop()}`
                        })
                    )
                })
                subPromises.push(truckRef.collection('drivers').add({
                    driver_uid: Users.getRef(truckData.driver_uid),
                    amount: 0,
                    idle: false
                }))
                return await Promise.all(subPromises)
            })

            promises.push(admin.firestore().runTransaction(t=>{
                let ref = admin.firestore().doc(Trucks.bucketPath)
                return t.get(ref).then((trucksListSnaphsot)=>{
                    let count = trucksListSnaphsot.data().trucksCount + 1
                    return t.update(ref,{trucksCount: count})
                })
            }))
            // remove intention and evently add new response  
            promises.push(admin.database().ref(`/intents/add_truck/${uid}/${ref}`).remove())
            await Promise.all(promises)
            return true
        })
    
    static listenAddTechnicalVisitIntent = functions.database.ref('/intents/add_technical_visit/{uid}/{ref}/finished')
        .onUpdate(async (change,context)=>{
            const snapshot = change.after
            if(!snapshot.val())
                return false
            const uid = context.params.uid
            const ref = context.params.ref

            const tvSnapshot = await admin.database().ref(`/intents/add_technical_visit/${uid}/${ref}`).once('value')
            const tvData = tvSnapshot.val()
            if(!Trucks.isValidTechnicalVisit(tvData))
                // format response and put into rtdb
                return false
            const truckSnapShot = await Trucks.getDoc(tvData.truck_id)
            //check if user is trucks owner
            if (truckSnapShot.data().owner_uid !== Users.getRef(uid))
                // format response and put into rtdb
                return false
            const promises = []
            //move images to new endpoint 
            const front_image_path = tvData.FRONT_IMAGE_URL.path
            const back_image_path = tvData.BACK_IMAGE_URL.path
            const FRONT_IMAGE_MV_PATH = `/trucks/${uid}/${truckSnapShot.id}/${front_image_path.split("/").pop()}`
            const BACK_IMAGE_MV_PATH = `/trucks/${uid}/${truckSnapShot.id}/${back_image_path.split("/").pop()}`
            promises.push(File.moveFileFromTo(front_image_path,FRONT_IMAGE_MV_PATH))
            promises.push(File.moveFileFromTo(back_image_path,BACK_IMAGE_MV_PATH))
            // create tv doc
            const tvDoc = {
                frontImageUrl: FRONT_IMAGE_MV_PATH,
                backImageUrl: BACK_IMAGE_MV_PATH,
                expirationDate: tvData.expirationDate,
                date: tvData.date,
                createdAt: FieldValue.serverTimestamp(),
                updatedAt: FieldValue.serverTimestamp()
            }
            console.log(tvDoc)
            // store it to firestore
            promises.push(admin.firestore().collection(Trucks.getRef(truckSnapShot.id)+'technical_visits').add(tvDoc))
            promises.push(admin.database().ref(`/intents/add_technical_visit/${uid}/${ref}`).remove())
            return Promise.all(promises)
        })

    static listenAddInsurranceIntent = functions.database.ref('/intents/add_insurrance/{uid}/{ref}/finished')
        .onUpdate(async (change,context)=>{
            const snapshot = change.after
            if(!snapshot.val())
                return false
            const uid = context.params.uid
            const ref = context.params.ref

            const insurranceSnapshot = await admin.database().ref(`/intents/add_insurrance/${uid}/${ref}`).once('value')
            const insurranceData = insurranceSnapshot.val()
            if(!Trucks.isValidInsurrance(insurranceData))
                // format response and put into rtdb
                return false
            const truckSnapShot = await Trucks.getDoc(insurranceData.truck_id)
            //check if user is trucks owner
            if (truckSnapShot.data().owner_uid !== Users.getRef(uid))
                // format response and put into rtdb
                return false
            const promises = []
            //move images to new endpoint 
            const front_image_path = insurranceData.FRONT_IMAGE_URL.path
            const back_image_path = insurranceData.BACK_IMAGE_URL.path
            const FRONT_IMAGE_MV_PATH = `/trucks/${uid}/${truckSnapShot.id}/${front_image_path.split("/").pop()}`
            const BACK_IMAGE_MV_PATH = `/trucks/${uid}/${truckSnapShot.id}/${back_image_path.split("/").pop()}`
            promises.push(File.moveFileFromTo(front_image_path,FRONT_IMAGE_MV_PATH))
            promises.push(File.moveFileFromTo(back_image_path,BACK_IMAGE_MV_PATH))
            // create tv doc
            const insurranceDoc = {
                frontImageUrl: FRONT_IMAGE_MV_PATH,
                backImageUrl: BACK_IMAGE_MV_PATH,
                expirationDate: insurranceData.expirationDate,
                date: insurranceData.date,
                createdAt: FieldValue.serverTimestamp(),
                updatedAt: FieldValue.serverTimestamp()
            }
            console.log(insurranceDoc)
            // store it to firestore
            promises.push(admin.firestore().collection(Trucks.getRef(truckSnapShot.id)+'insurrance').add(insurranceDoc))
            promises.push(admin.database().ref(`/intents/add_insurrance/${uid}/${ref}`).remove())
            return Promise.all(promises)
        })
}