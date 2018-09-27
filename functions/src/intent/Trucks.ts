import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import {File} from '../utils/File';
import { Users, Trucks } from '../models';
const FieldValue = require('firebase-admin').firestore.FieldValue;

export class TrucksIntent {

    static listenDeleteTruckIntent = functions.database.ref('/intents/delete_truck/{timestamp}/{ref}')
        .onCreate((snapshot,context)=>{
            const truckDataSnapshot = snapshot.val()
            return Trucks.getDocByRef(truckDataSnapshot.truckRef).then((truckSnapshot)=>{
                if(!truckSnapshot.exists){
                    snapshot.ref.child("response").set({code: 404})
                    return false
                }
                if(truckSnapshot.get('userRef')===truckDataSnapshot.userRef){
                    return truckSnapshot.ref.set({
                        deletedAt: FieldValue.serverTimestamp(),isDeleted:true},{merge: true})
                        .then(()=>{
                            snapshot.ref.child("response").set({code: 200})
                            return true
                        })
                        .catch((err)=>{
                            snapshot.ref.child("response").set({code: 500})
                            return false
                        });
                }else{
                  snapshot.ref.child("response").set({code: 401})
                  return false
                }
            }).catch((err)=>{
                snapshot.ref.child("response").set({code: 500})
                return false
            })
        })

    /*
    @Change driver of one truck
    - check if new driver exists
    - get previous driver and set it to idle
    - remove truck from previous driver
    - push new driver
    - add driver info to truck
    - add truck to driver
    - return code 200
    */
    static listenLinkNewDriverTruckIntent = functions.database.ref('/intents/link_new_driver_truck/{timestamp}/{truk_ref}')
        .onCreate( (snapshot,context)=>{
            const truckDataSnapshot = snapshot.val()
            return Trucks.getDocByRef(truckDataSnapshot.truckRef).then(async (truckSnapshot)=>{
                if(!truckSnapshot.exists){
                    snapshot.ref.child("response").set({code: 404})
                    return false
                }
                if(truckDataSnapshot.driverRef!== "N/A" && !Users.refExsits(truckDataSnapshot.driverRef)){
                    snapshot.ref.child("response").set({code: 404})
                    return false
                }
                if(truckSnapshot.get('userRef')===truckDataSnapshot.userRef){
                    const promises = []
                    promises.push(admin.firestore().collection(Trucks.getRef(context.params.truk_ref+"/drivers"))
                        .where("idle","==",false)
                        .limit(1)
                        .onSnapshot((driverQuerySnapshot)=>{
                            driverQuerySnapshot.forEach((driverSnapshot)=>{
                                promises.push(driverSnapshot.ref.set({idle: true},{merge: true}))
                                //remove truck from driver
                                promises.push(Users.getDocByRef(driverSnapshot.data().driverRef).then((driverUserRef)=>{
                                    return driverUserRef.ref.set({truck: null},{merge: true})
                                }))
                            })
                        }))
                    if(truckDataSnapshot.driverRef!== "N/A"){
                        //add driver inside drivers list
                        promises.push(truckSnapshot.ref.collection("drivers") .add({
                            driver_ref:truckDataSnapshot.driverRef,
                            amount: 0,
                            idle: false,
                            createdAt: FieldValue.serverTimestamp()
                        }))
                        //add driver info to truck
                        promises.push(truckSnapshot.ref.set({driver: {
                            fullName: Users.user.fullName,
                        }},{merge: true}))
                        //add truck info to driver
                        promises.push(Users.user.ref.set({truck: {
                            images: truckSnapshot.ref +"/images",
                            carrying_capacity:  truckSnapshot.get('carrying_capacity'),
                            category:truckSnapshot.get('category'),
                            common_name:truckSnapshot.get('common_name'),
                            immatriculation:truckSnapshot.get('immatriculation'),
                            make_by:truckSnapshot.get('make_by'),
                            model:truckSnapshot.get('model'),
                            number_of_seats: truckSnapshot.get('number_of_seats'),
                            number_of_tyres: truckSnapshot.get('number_of_tyres'),
                            start_work:  truckSnapshot.get('start_work'),
                            volume: truckSnapshot.get('volume'),
                            createdAt: FieldValue.serverTimestamp()
                        }},{merge: true}))
                    }else{
                        //remove previous driver
                        promises.push(truckSnapshot.ref.set({driver: null},{merge: true}))
                    }
                    //return respponse 200
                    return Promise.all(promises).then(()=>{
                        snapshot.ref.child("response").set({code: 200})
                        return false
                    })
                }else{
                    snapshot.ref.child("response").set({code: 401})
                    return false
                }
            }).catch((err)=>{
                snapshot.ref.child("response").set({code: 500})
                return false
            })
        })

    static listenAddTruckIntent = functions.database.ref('/intents/add_truck/{timestamp}/{ref}/finished')
        .onCreate(async (snapshot,context)=>{
            console.log(snapshot.val())
            if(!snapshot.val())
                return false
            const ref = context.params.ref
            const timestamp = context.params.timestamp

            const truckDataSnapshot = await admin.database().ref(`/intents/add_truck/${timestamp}/${ref}`).once('value')
            const truckData = truckDataSnapshot.val()
            //check if data is correct
            const response = await Trucks.isValidTruck(truckData) ;
            if (response !== true){
                // format response and put into rtdb
                admin.database().ref(`/intents/add_truck/${timestamp}/${ref}`).ref.child("response")
                    .set({code: response})
                return false
            }
            //create new truck doc to store into firestore
            const promises = []
            const end_date = new Date(Number.parseInt(truckData.start_date))
            end_date.setFullYear(end_date.getFullYear()+10)
            const truckDoc = {
                carrying_capacity:  +truckData.carrying_capacity,
                category: truckData.category,
                common_name: truckData.common_name,
                immatriculation: truckData.immatriculation,
                make_by: truckData.make_by,
                model: truckData.model,
                number_of_seats: +truckData.number_of_seats,
                number_of_tyres: +truckData.number_of_tyres,
                registration_certificate: {
                    rc_number: truckData.rc_number,
                    rc_ssdt_id: truckData.rc_ssdt_id,
                    start_date:  +truckData.start_date,
                    end_date: end_date.getTime(),
                    image: "",
                },
                start_work:  +truckData.start_work,
                userRef: truckData.userRef,
                volume: +truckData.volume,
                weight: +truckData.weight,
                image: "",
                driver: {},
                createdAt: FieldValue.serverTimestamp(),
                updatedAt: FieldValue.serverTimestamp(),
                isDisabled: false,
                isDeleted: false
            }
            if(truckData.driver_ref!=="N/A"){
                truckDoc.driver ={
                    fullName: Trucks.driver.fullName,
                }
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
                    if(truckData.driver_ref!=="N/A"){
                        subPromises.push(truckRef.collection('drivers').add({
                            driver_ref: Users.getRef(truckData.driver_ref),
                            amount: 0,
                            idle: false,
                            createdAt: FieldValue.serverTimestamp()
                        }))
                        
                        subPromises.push(Trucks.driver.ref.set({truck: {
                            images: truckRef +"/images",
                            carrying_capacity:  truckData.carrying_capacity,
                            category:truckData.category,
                            common_name:truckData.common_name,
                            immatriculation:truckData.immatriculation,
                            make_by:truckData.make_by,
                            model:truckData.model,
                            number_of_seats: truckData.number_of_seats,
                            number_of_tyres: truckData.number_of_tyres,
                            start_work:  truckData.start_work,
                            volume: truckData.volume,
                            createdAt: FieldValue.serverTimestamp()
                        }},{merge: true}))
                    }
                    Promise.all(subPromises).then(()=> {
                        admin.database().ref(`/intents/add_truck/${timestamp}/${ref}`).ref.child("response")
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
            }).catch((err)=>{
                console.log(err)
                admin.database().ref(`/intents/add_truck/${timestamp}/${ref}`)
                    .ref.child("response")
                    .set({code: 500})
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