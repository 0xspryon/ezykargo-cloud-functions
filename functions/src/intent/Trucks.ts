import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import {File} from '../utils/File';
import { Users, Trucks } from '../models';
const FieldValue = require('firebase-admin').firestore.FieldValue;

export class TrucksIntent {

    static listenAddTruckIntent = functions.database.ref('/intents/add_truck/{timestamp}/{ref}/finished')
        .onCreate(async (snapshot,context)=>{
            console.log(snapshot.val())
            if(!snapshot.val())
                return false
            const ref = context.params.ref
            const timestamp = context.params.timestamp

            const truckDataSnapshot = await admin.database().ref(`/intents/add_truck/${timestamp}/${ref}`).once('value')
            const truckData = truckDataSnapshot.val()
            console.log(truckData)
            //check if data is correct
            const response = await Trucks.isValidTruck(truckData) ;
            if (response !==true){
                // format response and put into rtdb
                truckDataSnapshot.child("response")
                    .set({code: response})
                return false
            }
            //create new truck doc to store into firestore
            const promises = []
            const end_date = new Date(Number.parseInt(truckData.start_date))
            end_date.setFullYear(end_date.getFullYear()+10)
            const truckDoc = {
                carrying_capacity:  truckData.carrying_capacity,
                category: truckData.category,
                common_name: truckData.common_name,
                immatriculation: truckData.immatriculation,
                make_by: truckData.make_by,
                model: truckData.model,
                number_of_seats: truckData.number_of_seats,
                number_of_tyres: truckData.number_of_tyres,
                registration_certificate: {
                    rc_number: truckData.rc_number,
                    rc_ssdt_id: truckData.rc_ssdt_id,
                    start_date:  truckData.start_date,
                    end_date: end_date.getTime(),
                    image: "",
                },
                start_work:  truckData.start_work,
                userRef: truckData.userRef,
                volume: truckData.volume,
                weight: truckData.weight,
                image: "",
                createdAt: FieldValue.serverTimestamp(),
                updatedAt: FieldValue.serverTimestamp(),
                isDeleted: false
            }

            console.log(truckDoc)
            const uid = truckData.userRef.split("/").pop()
            // move registration certificate image
            const ivRcString = truckData.ivRcString
            const newIvRcString = `/trucks/${uid}/rc/${ivRcString.split("/").pop()}`
            truckDoc.registration_certificate.image = newIvRcString
            promises.push(File.moveFileFromTo(ivRcString,newIvRcString))
            //moves truck images
            const imageCar1 = truckData.imageCar1
            const newImageCar1 = `/trucks/${uid}/${imageCar1.split("/").pop()}`
            truckDoc.image = newImageCar1
            promises.push(File.moveFileFromTo(imageCar1,newImageCar1))

            const imageCar2 = truckData.imageCar2
            const newImageCar2 = `/trucks/${uid}/${imageCar2.split("/").pop()}`
            promises.push(File.moveFileFromTo(imageCar2,newImageCar2))

            const imageCar3 = truckData.imageCar3
            const newImageCar3 = `/trucks/${uid}/${imageCar3.split("/").pop()}`
            promises.push(File.moveFileFromTo(imageCar3,newImageCar3))

            const imageCar4 = truckData.imageCar4
            const newImageCar4 = `/trucks/${uid}/${imageCar4.split("/").pop()}`
            promises.push(File.moveFileFromTo(imageCar4,newImageCar4))

            const imageCar5 = truckData.imageCar5
            const newImageCar5 = `/trucks/${uid}/${imageCar5.split("/").pop()}`
            promises.push(File.moveFileFromTo(imageCar5,newImageCar5))

            const imageCar6 = truckData.imageCar6
            const newImageCar6 = `/trucks/${uid}/${imageCar6.split("/").pop()}`
            promises.push(File.moveFileFromTo(imageCar6,newImageCar6))

            const truckRef = admin.firestore().collection(Trucks.basePath).doc()
            promises.push( new Promise((resolve, reject) => {
                truckRef.set(truckDoc).then(()=> {
                    console.log(truckRef)
                    const subPromises = []
                    subPromises.push(truckRef.collection("images").add({url: newImageCar1}))
                    subPromises.push(truckRef.collection("images").add({url: newImageCar2}))
                    subPromises.push(truckRef.collection("images").add({url: newImageCar3}))
                    subPromises.push(truckRef.collection("images").add({url: newImageCar4}))
                    subPromises.push(truckRef.collection("images").add({url: newImageCar5}))
                    subPromises.push(truckRef.collection("images").add({url: newImageCar6}))
                    subPromises.push(admin.firestore().runTransaction(t=>{
                        const refTrucks = admin.firestore().doc(Trucks.bucketPath)
                        return t.get(refTrucks).then((trucksListSnaphsot)=>{
                            const count = trucksListSnaphsot.data().trucksCount + 1
                            return t.update(refTrucks,{trucksCount: count})
                        })
                    }))
                    // remove intention and evently add new response  
                    //subPromises.push(admin.database().ref(`/intents/add_truck/${timestamp}/${ref}`).remove())
                    if(truckData.driverRef!=="N/A")
                        subPromises.push(truckRef.collection('drivers').add({
                            driverRef: Users.getRef(truckData.driverRef),
                            amount: 0,
                            idle: false
                        }))
                    Promise.all(subPromises).then(()=> {
                        
                        truckDataSnapshot.child("response")
                            .set({code: 201}).then(()=> {
                                resolve(true) 
                            }).catch((err)=> {
                                reject(err)
                            })
                    }).catch((err)=> {
                        reject(err)
                    })
                }).catch((err)=> {
                    reject(err)
                })
            }))

            return Promise.all(promises)
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