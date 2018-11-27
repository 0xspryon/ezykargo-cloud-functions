import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import { File } from '../utils/File';
import { Users, Trucks } from '../models';
const FieldValue = require('firebase-admin').firestore.FieldValue;

export class TrucksIntent {

    static listenDeleteTruckIntent = functions.database.ref('/intents/delete_truck/{timestamp}/{ref}')
        .onCreate((snapshot, context) => {
            const firestore = admin.firestore()

            const truckDataSnapshot = snapshot.val()
            return firestore.doc(truckDataSnapshot.truckRefString).get()
                // Trucks.getDocByRef(truckDataSnapshot.truckRef)
                .then((truckSnapshot) => {
                    if (!truckSnapshot.exists) {
                        snapshot.ref.child("response").set({ code: 404 })
                        return false
                    }
                    if (truckSnapshot.get('userRef') === truckDataSnapshot.userRef) {
                        return truckSnapshot.ref
                        .set(
                            {
                                deletedAt: FieldValue.serverTimestamp(),
                                isDeleted: true,
                            },
                            { merge: true }
                        )
                            .then(() => {
                                console.log("Set deleted at value")
                                const driver = truckDataSnapshot.driver
                                if (driver) {
                                    firestore.doc(truckDataSnapshot.driver.ref)
                                        .set({ truck: null }, { merge: true })
                                }
                                console.log("Set truck attribute on driver to null")
                                snapshot.ref.child("response").set({ code: 204 })
                                console.log("set code")
                                return true
                            })
                            .catch((err) => {
                                console.log({ err })
                                snapshot.ref.child("response").set({ code: 500 })
                                return false
                            });
                    } else {
                        snapshot.ref.child("response").set({ code: 401 })
                        return false
                    }
                }).catch((err) => {
                    snapshot.ref.child("response").set({ code: 500 })
                    return false
                })
        })

    /*
    @Change driver of one truck
    - verify user at userRef owns the car
    - check if new driver exists
    - get previous driver and set it to idle
    - remove truck from previous driver
    - push new driver to truck drivers collection
    - add driver info to truck
    - add truck info to driver
    - return code 201 or an error-code 
    */
    static listenLinkNewDriverTruckIntent = functions.database.ref('/intents/{timestamp}/associate_driver/{push_id}')
        .onCreate((snapshot, context) => {
            const newIntentDataSnapshot = snapshot.val()
            // const firestore = admin.firestore()
            return Trucks.getDocByRef(newIntentDataSnapshot.truckRef)
                .then(truckSnapshot => {
                    if (!truckSnapshot.exists) {
                        snapshot.ref.child("response").set({ code: 404 })
                        return false
                    }
                    if (newIntentDataSnapshot.driverRef !== "N/A" && !Users.refExsits(newIntentDataSnapshot.driverRef)) {
                        snapshot.ref.child("response").set({ code: 404 })
                        return false
                    }
                    if (truckSnapshot.get('userRef') === newIntentDataSnapshot.userRef) {
                        const promises = []
                        const firestore = admin.firestore()
                        promises.push(firestore.collection(truckSnapshot.ref.path + "/drivers")
                            // promises.push(firestore.collection(Trucks.getRef(context.params.push_id+"/drivers"))
                            .where("idle", "==", false)
                            .limit(1)
                            .get()
                            .then(driverQuerySnapshot => {
                                driverQuerySnapshot.forEach((driverSnapshot) => {
                                    console.log(driverSnapshot.data())
                                    promises.push(driverSnapshot.ref.set({ idle: true }, { merge: true }))
                                    //remove truck from drivernewIntentDataSnapshot.truckRef
                                    promises.push(Users.getDocByRef(driverSnapshot.data().driver_ref).then((driverDocumentSnapshot) => {
                                        const microPromise = driverDocumentSnapshot.ref.set({ truck: null }, { merge: true })
                                        promises.push(microPromise)
                                        // return microPromise
                                    }))
                                })
                            }))
                        // if(newIntentDataSnapshot.driverRef!== "N/A"){
                        //add driver inside drivers list
                        promises.push(truckSnapshot.ref.collection("drivers").add({
                            driver_ref: newIntentDataSnapshot.driverRef,
                            amount: 0,
                            idle: false,
                            createdAt: FieldValue.serverTimestamp()
                        }))
                        //add driver info to truck
                        promises.push(new Promise((resolve, reject) => {
                            firestore.doc(newIntentDataSnapshot.driverRef).get()
                                .then(driverDataSnapshot => {
                                    let driverCount = 1;
                                    const truckData = truckSnapshot.data()
                                    if (truckData) {
                                        driverCount = truckData.driverCount + 1
                                    }
                                    truckSnapshot.ref.set({
                                        driver: {
                                            fullName: driverDataSnapshot.data().fullName,
                                        },
                                        driver_ref: newIntentDataSnapshot.driverRef,
                                        hasCurrentDriver: true,
                                        driverCount: driverCount,
                                    }, { merge: true })
                                        .then(() => resolve())
                                        .catch((onrejected) => {
                                            console.log({ onrejected })
                                            reject()
                                        })

                                })
                                .catch((onrejected) => {
                                    console.log({ onrejected })
                                    reject()
                                })
                        }))
                        //add truck info to driver
                        promises.push(firestore.doc(newIntentDataSnapshot.driverRef).set({
                            truck: {
                                truckRef: truckSnapshot.ref,
                                images: truckSnapshot.get("images"),
                                carrying_capacity: +truckSnapshot.get('carrying_capacity'),
                                category: truckSnapshot.get('category'),
                                common_name: truckSnapshot.get('common_name'),
                                immatriculation: truckSnapshot.get('immatriculation'),
                                make_by: truckSnapshot.get('make_by'),
                                model: truckSnapshot.get('model'),
                                number_of_seats: +truckSnapshot.get('number_of_seats'),
                                number_of_tyres: +truckSnapshot.get('number_of_tyres'),
                                start_work: +truckSnapshot.get('start_work'),
                                hasAValidInsurrance: truckSnapshot.get('hasAValidInsurrance'),
                                hasValidTechnicalVisit: truckSnapshot.get('hasValidTechnicalVisit'),
                                volume: +truckSnapshot.get('volume'),
                                createdAt: FieldValue.serverTimestamp()
                            }
                        }, { merge: true }))
                        // }else{
                        //remove previous driver
                        promises.push(truckSnapshot.ref.set({ driver: null }, { merge: true }))
                        // }
                        //return respponse 200
                        return Promise.all(promises).then(() => {
                            snapshot.ref.child("response").set({ code: 201 })
                            return false
                        })
                    } else {
                        snapshot.ref.child("response").set({ code: 401 })
                        return false
                    }
                }).catch((association_driver_error_internal_500) => {
                    console.log({ association_driver_error_internal_500 })
                    snapshot.ref.child("response").set({ code: 500 })
                    return false
                })
        })


    /*
    @dissociate a driver of one truck
    - verify user at userRef owns the car
    - check if driver at driverRef exists
    - get the driver and set it to idle
    - remove truck info from driver
    - remove driver info from truck
    - return code 201 or any appropriate error-code
    */
    static listenUnLinkDriverTruckIntent = functions.database.ref('/intents/{timestamp}/dissociate_driver/{push_id}')
        .onCreate((snapshot, context) => {
            const dissociateDriverDataSnapshot = snapshot.val()
            const firestore = admin.firestore()
            return Trucks.getDocByRef(dissociateDriverDataSnapshot.truckRef)
                .then(truckSnapshot => {
                    if (!truckSnapshot.exists) {
                        snapshot.ref.child("response").set({ code: 404 })
                        return false
                    }

                    return firestore.doc(dissociateDriverDataSnapshot.driverRef).get()
                        .then(driverSnapShot => {
                            if (dissociateDriverDataSnapshot.driverRef !== "N/A" && !driverSnapShot.exists) {
                                snapshot.ref.child("response").set({ code: 404 })
                                return false
                            }
                            if (truckSnapshot.get('userRef') === dissociateDriverDataSnapshot.userRef) {
                                const promises = []
                                promises.push(firestore.collection(truckSnapshot.ref.path + "/drivers")
                                    .where("driver_ref", "==", dissociateDriverDataSnapshot.driverRef)
                                    .orderBy('createdAt', 'desc')
                                    .limit(1)
                                    .get()
                                    .then(driverQuerySnapshot => {
                                        driverQuerySnapshot.forEach((driverSnapshot) => {
                                            console.log({ driverSnapshot: driverSnapshot.data() })
                                            promises.push(driverSnapshot.ref.set({ idle: true }, { merge: true }))
                                            promises.push(driverSnapShot.ref.set({ truck: null }, { merge: true }))
                                        })
                                    }))
                                promises.push(
                                    truckSnapshot.ref.set(
                                        {
                                            driver: {
                                                fullName: "N/A",
                                            },
                                            driver_ref: "N/A",
                                            hasCurrentDriver: false,
                                            dissociatedAt: FieldValue.serverTimestamp(),
                                        }, { merge: true }
                                    )
                                )
                                // console.log('promising and alling')
                                return Promise.all(promises).then(() => {
                                    snapshot.ref.child("response").set({ code: 201 })
                                    return false
                                })
                                    .catch(err => {
                                        console.log({ err })
                                        snapshot.ref.child("response").set({ code: 500 })
                                        return false
                                    })
                            } else {
                                snapshot.ref.child("response").set({ code: 401 })
                                return false
                            }

                        })
                }).catch((association_driver_error_internal_500) => {
                    console.log({ association_driver_error_internal_500 })
                    snapshot.ref.child("response").set({ code: 500 })
                    return false
                })
        })

    /*
    @Creates a new truck
    - fetch the actual car that is to be created from 
        firestore after all images are loaded
    - construct truck instance
    - Asynchronously transfer images to their final destination
    - save truck instance
    - Save truck info to driver if he is associated directly to that car
    - Save response
    - return code 201 or any appropriate error-code
    */
    static listenAddTruckIntent = functions.database.ref('/intents/add_truck/{timestamp}/{ref}/finished')
        .onCreate((snapshot, context) => {
            // console.log(snapshot.val())
            if (!snapshot.val())
                return false
            const ref = context.params.ref
            const timestamp = context.params.timestamp

            let truckDoc;
            const firestore = admin.firestore();
            const db = admin.database();

            return new Promise((outerPromiseResolve, outerPromiseReject) => {
                db.ref(`/intents/add_truck/${timestamp}/${ref}`)
                    .once('value', truckDataSnapshot => {
                        const truckData = truckDataSnapshot.val()
                        console.log({ truckData })
                        const promises = []
                        const end_date = new Date(Number.parseInt(truckData.start_date))
                        end_date.setFullYear(end_date.getFullYear() + 10)
                        truckDoc = {
                            carrying_capacity: +truckData.carrying_capacity,
                            category: truckData.category,
                            common_name: truckData.common_name,
                            immatriculation: truckData.immatriculation,
                            make_by: truckData.make_by,
                            hasAValidInsurrance: false,
                            model: truckData.model,
                            hasCurrentDriver: false,
                            hasValidTechnicalVisit: false,
                            number_of_seats: +truckData.number_of_seats,
                            number_of_tyres: +truckData.number_of_tyres,
                            registration_certificate: {
                                rc_number: truckData.rc_number,
                                rc_ssdt_id: truckData.rc_ssdt_id,
                                start_date: +truckData.start_date,
                                end_date: end_date.getTime(),
                                image: "",
                            },
                            start_work: +truckData.start_work,
                            userRef: truckData.userRef,
                            volume: +truckData.volume,
                            weight: +truckData.weight,
                            driver: {},
                            createdAt: FieldValue.serverTimestamp(),
                            updatedAt: FieldValue.serverTimestamp(),
                            isDisabled: false,
                            isDeleted: false
                        }
                        if (truckData.driver_ref !== "N/A") {
                            truckDoc.driver = {
                                fullName: truckData.driverFullName,
                                ref: truckData.driver_ref,
                            }
                            truckDoc[`driverCount`] = 1;
                        }
                        const uid = truckData.userRef.split("/").pop()

                        console.log('saving images now')

                        // move registration certificate image
                        const ivRcString = truckData.ivRcString
                        const newIvRcString = `/trucks/${uid}/rc/${ivRcString.split("/").pop()}`
                        truckDoc.registration_certificate.image = newIvRcString
                        promises.push(File.moveFileFromTo(ivRcString, newIvRcString))
                        //moves truck images
                        const imageCar1 = truckData.imageCar1
                        const newImageCar1 = `/trucks/${uid}/${imageCar1.split("/").pop()}`

                        promises.push(File.moveFileFromTo(imageCar1, newImageCar1))

                        const imageCar2 = truckData.imageCar2
                        const newImageCar2 = `/trucks/${uid}/${imageCar2.split("/").pop()}`
                        promises.push(File.moveFileFromTo(imageCar2, newImageCar2))

                        const imageCar3 = truckData.imageCar3
                        const newImageCar3 = `/trucks/${uid}/${imageCar3.split("/").pop()}`
                        promises.push(File.moveFileFromTo(imageCar3, newImageCar3))

                        const imageCar4 = truckData.imageCar4
                        const newImageCar4 = `/trucks/${uid}/${imageCar4.split("/").pop()}`
                        promises.push(File.moveFileFromTo(imageCar4, newImageCar4))

                        const imageCar5 = truckData.imageCar5
                        const newImageCar5 = `/trucks/${uid}/${imageCar5.split("/").pop()}`
                        promises.push(File.moveFileFromTo(imageCar5, newImageCar5))

                        const imageCar6 = truckData.imageCar6
                        const newImageCar6 = `/trucks/${uid}/${imageCar6.split("/").pop()}`
                        promises.push(File.moveFileFromTo(imageCar6, newImageCar6))

                        truckDoc[`images`] = [newImageCar1, newImageCar2, newImageCar3, newImageCar4, newImageCar5, newImageCar6,]

                        promises.push(
                            new Promise(
                                (resolve, reject) => {
                                    const truckRefTesting = firestore.collection('bucket/trucksList/trucks').doc();
                                    console.log(truckDoc)
                                    truckRefTesting.set(truckDoc)
                                        .then(() => {
                                            console.log({ truckRefTestingPath: truckRefTesting.path })
                                            const subPromises = []
                                            subPromises.push(firestore.runTransaction(t => {
                                                const refTrucks = firestore.doc(Trucks.bucketPath)
                                                return t.get(refTrucks).then((trucksListSnaphsot) => {
                                                    let trucksCount = 1
                                                    if (trucksListSnaphsot.exists) {
                                                        trucksCount = +trucksListSnaphsot.data().trucksCount + 1
                                                        return t.update(refTrucks, { trucksCount })
                                                    } else {
                                                        return t.set(refTrucks, { trucksCount })
                                                    }
                                                })
                                            }))
                                            if (truckData.driver_ref !== "N/A") {
                                                subPromises.push(truckRefTesting.collection('drivers').add({
                                                    driver_ref: truckData.driver_ref,
                                                    driver_name: truckData.driverFullName,
                                                    amount: 0,
                                                    idle: false,
                                                    createdAt: FieldValue.serverTimestamp()
                                                }))

                                                subPromises.push(firestore.doc(truckData.driver_ref).set({
                                                    truck: {
                                                        images: [newImageCar1, newImageCar2, newImageCar3, newImageCar4, newImageCar5, newImageCar6,],
                                                        carrying_capacity: +truckData.carrying_capacity,
                                                        category: truckData.category,
                                                        common_name: truckData.common_name,
                                                        immatriculation: truckData.immatriculation,
                                                        make_by: truckData.make_by,
                                                        model: truckData.model,
                                                        number_of_seats: +truckData.number_of_seats,
                                                        number_of_tyres: +truckData.number_of_tyres,
                                                        start_work: +truckData.start_work,
                                                        volume: +truckData.volume,
                                                        createdAt: FieldValue.serverTimestamp()
                                                    }
                                                }, { merge: true }))
                                            }
                                            Promise.all(subPromises)
                                                .then(() => {
                                                    db.ref(`/intents/add_truck/${timestamp}/${ref}`).ref.child("response")
                                                        .set({ code: 201 })
                                                        .then(() => {
                                                            resolve(true)
                                                            return true;
                                                        })
                                                })
                                                .catch((err) => {
                                                    console.log({ err })
                                                    db.ref(`/intents/add_truck/${timestamp}/${ref}`)
                                                        .ref.child("response")
                                                        .set({ code: 500 })
                                                    reject(err)
                                                    return false;
                                                })
                                        }).catch((errAtTruckRefSettingTesting) => {
                                            console.log({ errAtTruckRefSettingTesting })
                                            db.ref(`/intents/add_truck/${timestamp}/${ref}`)
                                                .ref.child("response")
                                                .set({ code: 500 })
                                            reject(errAtTruckRefSettingTesting)
                                        })
                                }
                            )
                        )
                        Promise.all(promises)
                            .then(succ => {
                                outerPromiseResolve()
                            })
                            .catch(errAtFinalPromise => {
                                console.log({ errAtFinalPromise })
                                outerPromiseReject()
                            })
                    })

            })

        })

    static listenAddTechnicalVisitIntent = functions.database.ref('/intents/add_technical_visit/{uid}/{ref}/finished')
        .onUpdate(async (change, context) => {
            const snapshot = change.after
            if (!snapshot.val())
                return false
            const uid = context.params.uid
            const ref = context.params.ref

            const tvSnapshot = await admin.database().ref(`/intents/add_technical_visit/${uid}/${ref}`).once('value')
            const tvData = tvSnapshot.val()
            if (!Trucks.isValidTechnicalVisit(tvData))
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
            promises.push(File.moveFileFromTo(front_image_path, FRONT_IMAGE_MV_PATH))
            promises.push(File.moveFileFromTo(back_image_path, BACK_IMAGE_MV_PATH))
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
            promises.push(admin.firestore().collection(Trucks.getRef(truckSnapShot.id) + 'technical_visits').add(tvDoc))
            promises.push(admin.database().ref(`/intents/add_technical_visit/${uid}/${ref}`).remove())
            return Promise.all(promises)
        })

    static listenAddInsurranceIntent = functions.database.ref('/intents/add_insurrance/{uid}/{ref}/finished')
        .onUpdate(async (change, context) => {
            const snapshot = change.after
            if (!snapshot.val())
                return false
            const uid = context.params.uid
            const ref = context.params.ref

            const insurranceSnapshot = await admin.database().ref(`/intents/add_insurrance/${uid}/${ref}`).once('value')
            const insurranceData = insurranceSnapshot.val()
            if (!Trucks.isValidInsurrance(insurranceData))
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
            promises.push(File.moveFileFromTo(front_image_path, FRONT_IMAGE_MV_PATH))
            promises.push(File.moveFileFromTo(back_image_path, BACK_IMAGE_MV_PATH))
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
            promises.push(admin.firestore().collection(Trucks.getRef(truckSnapShot.id) + 'insurrance').add(insurranceDoc))
            promises.push(admin.database().ref(`/intents/add_insurrance/${uid}/${ref}`).remove())
            return Promise.all(promises)
        })
}