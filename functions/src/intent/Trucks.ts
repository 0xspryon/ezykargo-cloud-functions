import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import { File } from '../utils/File';
import { Users, Trucks } from '../models';
import { NotificationActions } from '../models/NotificationActions';
const FieldValue = require('firebase-admin').firestore.FieldValue;

const truckDocumentsPath = "bucket/trucksDocuments"

export class TrucksIntent {
    static INCONSISTENT: number = 400;

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

                    const truckData = truckSnapshot.data()
                    if (truckData.hasCurrentDriver) {
                        snapshot.ref.child("response").set({ code: TrucksIntent.INCONSISTENT })
                        return false
                    }
                    if (truckSnapshot.get('userRef') === truckDataSnapshot.userRef) {
                        return truckSnapshot.ref
                            .set(
                                {
                                    driver: null,
                                    driver_ref: null,
                                    hasCurrentDriver: false,
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
    - Verify truck has no driver
    - push new driver to truck drivers collection
    - add driver info to truck
    - add truck info to driver
    - return code 201 or an error-code
    - 409: conflict, driver already has a truck.
    - 404: not found, driver can't be found.
    */
    static listenLinkNewDriverTruckIntent = functions.database.ref('/intents/associate_driver/{timestamp}/{push_id}')
        .onCreate((snapshot, context) => {
            const newIntentDataSnapshot = snapshot.val()
            let consentData: any;
            // const firestore = admin.firestore()
            return Trucks.getDocByRef(newIntentDataSnapshot.truckRef)
                .then(async truckSnapshot => {
                    if (!truckSnapshot.exists) {
                        snapshot.ref.child("response").set({ code: 404 })
                        return false
                    }

                    //verify trucker has no truck before associating
                    if (newIntentDataSnapshot.driverRef != "N/A") {
                        await new Promise((resolve, reject) => {
                            admin.database().ref(newIntentDataSnapshot.consentRef).once('value', consentSnapshot => {
                                if (consentSnapshot.exists) {
                                    consentData = consentSnapshot.val()
                                    console.log(consentData)
                                    resolve(consentSnapshot.val())
                                }
                                else {
                                    snapshot.ref.child("response").set({ code: 400 })
                                    reject("No consent was made with the driver")
                                }
                                consentSnapshot.ref.remove()
                            })
                        })

                        if (consentData.response.code !== 200 && consentData.response.driverRef !== newIntentDataSnapshot.driverRef) {
                            snapshot.ref.child("response").set({ code: 401 })
                            return false
                        }

                        const driverSnapshot = await admin.firestore().doc(newIntentDataSnapshot.driverRef).get()
                        if (driverSnapshot.exists) {
                            const driverData = driverSnapshot.data();

                            console.log({ truck: driverData.truck })

                            if (driverData.truck) {
                                snapshot.ref.child("response").set({ code: 409 })
                                return false
                            }
                        } else {
                            snapshot.ref.child("response").set({ code: 404 })
                            return false
                        }
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
                                    // console.log(driverSnapshot.data())
                                    promises.push(driverSnapshot.ref.set({ idle: true }, { merge: true }))
                                    //remove truck from drivernewIntentDataSnapshot.truckRef
                                    // promises.push(firestore.doc(driverSnapshot.data().driver_ref).set({ truck: null }, { merge: true }))
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
                                        percentage: consentData.percentage,
                                        contractDate: FieldValue.serverTimestamp(),
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
                                contractDate: FieldValue.serverTimestamp(),
                                percentage: consentData.percentage,
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
                        // promises.push(truckSnapshot.ref.set({ driver: null }, { merge: true }))
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
    - remove dissociation notification from driver
    - remove driver info from truck
    - return code 201 or any appropriate error-code
    */
    static listenUnLinkDriverTruckIntent = functions.database.ref('/intents/dissociate_driver/{timestamp}/{push_id}')
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
                                    .orderBy('createdAt', 'asc')
                                    .limit(1)
                                    .get()
                                    .then(truckerDriverQuerySnapshot => {
                                        truckerDriverQuerySnapshot.forEach((truckDriverSnapshot) => {
                                            promises.push(truckDriverSnapshot.ref.set({
                                                idle: true,
                                                truck: null,
                                                markedForDissociationAt: null,
                                                markedForDissociation: false,
                                            }, { merge: true }))
                                        })
                                    }))

                                promises.push(firestore.collection(driverSnapShot.ref.path + '/notifications')
                                    .orderBy('createdAt', 'asc')
                                    .where("action", "==", NotificationActions.DISSOCIATION_NOTIFICATION_ACTION)
                                    .limit(1)
                                    .get()
                                    .then(dissociationNotificationsSnapshot => {
                                        dissociationNotificationsSnapshot.forEach(dissociationNotificationSnapshot => {
                                            promises.push(dissociationNotificationSnapshot.ref.delete())
                                        })
                                    }))

                                const driverdoc = driverSnapShot.data()
                                delete driverdoc.truck
                                promises.push(driverSnapShot.ref.set({ ...driverdoc }))

                                promises.push(
                                    truckSnapshot.ref.set(
                                        {
                                            driver: {
                                                fullName: "N/A",
                                            },
                                            driver_ref: "N/A",
                                            hasCurrentDriver: false,
                                            dissociatedAt: FieldValue.serverTimestamp(),
                                            markedForDissociationAt: null,
                                            markedForDissociation: false,
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
                }).catch((dissociation_driver_error_internal_500) => {
                    console.log({ dissociation_driver_error_internal_500 })
                    snapshot.ref.child("response").set({ code: 500 })
                    return false
                })
        })


    /*
    @notify dissociation of a  a trucker
    - verify user at userRef owns the car
    - check if driver at driverRef exists
    - mark truck for dissociation
    - get driver from truck drivers and mark for dissociation
    - get driver add notification of dissociation
    - return code 201 or any appropriate error-code
    */
    static listenNotifyDriverOfDissociation = functions.database.ref('/intents/notify_dissociate_driver/{timestamp}/{push_id}')
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
                            const NUMBER_OF_NOTIFICATION_DAYS_TO_ACTUAL_DISSOCIATION = 7;
                            if (dissociateDriverDataSnapshot.driverRef !== "N/A" && !driverSnapShot.exists) {
                                snapshot.ref.child("response").set({ code: 404 })
                                return false
                            }
                            if (truckSnapshot.get('userRef') === dissociateDriverDataSnapshot.userRef) {
                                const promises = []
                                promises.push(firestore.collection(truckSnapshot.ref.path + "/drivers")
                                    .orderBy('createdAt', 'asc')
                                    .where("driver_ref", "==", dissociateDriverDataSnapshot.driverRef)
                                    .limit(1)
                                    .get()
                                    .then(driverQuerySnapshot => {
                                        driverQuerySnapshot.forEach((truckerDriverSnapshot) => {
                                            console.log({ driverSnapshot: truckerDriverSnapshot.data() })
                                            promises.push(
                                                truckSnapshot.ref.set(
                                                    {
                                                        markedForDissociation: true,
                                                        markedForDissociationAt: FieldValue.serverTimestamp()
                                                    }, { merge: true }
                                                )
                                            )
                                            promises.push(truckerDriverSnapshot.ref.set({
                                                markedForDissociation: true,
                                                markedForDissociationAt: FieldValue.serverTimestamp(),
                                            }, { merge: true })
                                            )
                                            promises.push(firestore.collection(dissociateDriverDataSnapshot.driverRef + '/notifications').add({
                                                action: NotificationActions.DISSOCIATION_NOTIFICATION_ACTION,
                                                createdAt: FieldValue.serverTimestamp(),
                                                dueTo: NUMBER_OF_NOTIFICATION_DAYS_TO_ACTUAL_DISSOCIATION,
                                            }))
                                        })
                                    }))
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
                }).catch((notify_dissociation_driver_error_internal_500) => {
                    console.log({ notify_dissociation_driver_error_internal_500 })
                    snapshot.ref.child("response").set({ code: 500 })
                    return false
                })
        })
    /*
    @notify dissociation of a  a trucker
    - verify user at userRef owns the car
    - check if driver at driverRef exists
    - unmark truck for dissociation
    - get driver from truck drivers and unmark for dissociation
    - get driver remove notification of dissociation
    - return code 201 or any appropriate error-code
    */
    static listenCancelNotifyDriverOfDissociation = functions.database.ref('/intents/cancel_notify_dissociate_driver/{timestamp}/{push_id}')
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
                            // const NUMBER_OF_NOTIFICATION_DAYS_TO_ACTUAL_DISSOCIATION = 7;
                            if (dissociateDriverDataSnapshot.driverRef !== "N/A" && !driverSnapShot.exists) {
                                snapshot.ref.child("response").set({ code: 404 })
                                return false
                            }
                            if (truckSnapshot.get('userRef') === dissociateDriverDataSnapshot.userRef) {
                                const promises = []
                                promises.push(firestore.collection(truckSnapshot.ref.path + "/drivers")
                                    .orderBy('createdAt', 'asc')
                                    .where("driver_ref", "==", dissociateDriverDataSnapshot.driverRef)
                                    .limit(1)
                                    .get()
                                    .then(driverQuerySnapshot => {
                                        driverQuerySnapshot.forEach((truckerDriverSnapshot) => {
                                            console.log({ driverSnapshot: truckerDriverSnapshot.data() })
                                            const truckData = truckSnapshot.data()
                                            delete truckData.markedForDissociation
                                            delete truckData.markedForDissociationAt;
                                            promises.push(
                                                truckSnapshot.ref.set({ ...truckData })
                                            )
                                            promises.push(truckerDriverSnapshot.ref.set({
                                                markedForDissociation: false,
                                                markedForDissociationAt: null,
                                            }, { merge: true })
                                            )
                                            promises.push(firestore.collection(dissociateDriverDataSnapshot.driverRef + '/notifications')
                                                .orderBy('createdAt', 'asc')
                                                .where("action", "==", NotificationActions.DISSOCIATION_NOTIFICATION_ACTION)
                                                .limit(1)
                                                .get()
                                                .then(dissociationNotificationsSnapshot => {
                                                    dissociationNotificationsSnapshot.forEach(dissociationNotificationSnapshot => {
                                                        promises.push(dissociationNotificationSnapshot.ref.delete())
                                                    })
                                                }))
                                        })
                                    }))
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
                }).catch((notify_dissociation_driver_error_internal_500) => {
                    console.log({ notify_dissociation_driver_error_internal_500 })
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
                            hasAValidInsurrance: true,
                            model: truckData.model,
                            hasCurrentDriver: false,
                            hasValidTechnicalVisit: true,
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
                            driverCount: 0,
                            createdAt: FieldValue.serverTimestamp(),
                            updatedAt: FieldValue.serverTimestamp(),
                            isDisabled: false,
                            isDeleted: false
                        }
                        // if (truckData.driver_ref !== "N/A") {
                        //     truckDoc.hasCurrentDriver = true
                        //     truckDoc.driver = {
                        //         fullName: truckData.driverFullName,
                        //         ref: truckData.driver_ref,
                        //     }
                        //     truckDoc[`driverCount`] = 1;
                        // }
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
                                                        weight: +truckData.weight,
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

    static listenAddTechnicalVisitIntent = functions.database.ref('/intents/add_technical_visit/{ref}/finished')
        .onCreate(async (snapshot, context) => {
            if (!snapshot.val())
                return false
            const ref = context.params.ref

            const TechnicalVistSnapshot = await admin.database().ref(`/intents/add_technical_visit/${ref}`).once('value')
            const TechnicalVistData = TechnicalVistSnapshot.val()

            const truckSnapShot = await Trucks.getDocByRef(TechnicalVistData.truck_ref)
            const repSnapShot = await Users.getDocByRef(TechnicalVistData.user_ref)

            if (!truckSnapShot.data())
                return admin.database().ref(`/intents/add_technical_visit/${ref}/response`).ref.set({ code: 404 })
            if (truckSnapShot.data().immatriculation.toLocaleLowerCase() !== TechnicalVistData.immatriculation.toLocaleLowerCase())
                return admin.database().ref(`/intents/add_technical_visit/${ref}/response`).ref.set({ code: 403 })
            if (!repSnapShot.data().is_ezy_rep)
                return admin.database().ref(`/intents/add_technical_visit/${ref}/response`).ref.set({ code: 401 })
            const promises = []
            //move images to new endpoint 
            let image_path = TechnicalVistData.image_url
            image_path = image_path.split("?")[0]
            const IMAGE_MV_PATH = `/trucks/${ref}/${truckSnapShot.id}/${image_path.split("/").pop()}`
            promises.push(File.moveFileFromTo(image_path, IMAGE_MV_PATH))
            // create tv doc
            const TechnicalVistDoc = {
                imageUrl: IMAGE_MV_PATH,
                expirationDate: TechnicalVistData.expiration_date,
                date: TechnicalVistData.date,
                recordNumber: TechnicalVistData.record_number,
                serialNumber: TechnicalVistData.serial_number,
                createdAt: FieldValue.serverTimestamp(),
                updatedAt: FieldValue.serverTimestamp()
            }
            console.log(TechnicalVistDoc)
            // store it to firestore
            promises.push(admin.firestore().collection(truckDocumentsPath + '/technical_visits').add({
                ...TechnicalVistDoc,
                addBy: TechnicalVistData.user_ref,
                truckRef: TechnicalVistData.truck_ref
            }))
            promises.push(truckSnapShot.ref.set({
                "technical_visit": TechnicalVistDoc,
                "hasValidTechnicalVisit": true,
            }, { merge: true }))
            // change status of car on driver document if truck currently have driver 
            if (truckSnapShot.data().hasCurrentDriver && truckSnapShot.data().driver_ref) {
                promises.push(Users.getDocByRef(truckSnapShot.data().driver_ref).then((driverSnapshot) => {
                    const truckDataForDriver = {
                        truck: {
                            hasValidTechnicalVisit: true
                        },
                        hasValidTruck: false
                    }
                    if (driverSnapshot.data().truck.hasValidRegistrationCertificate && driverSnapshot.data().truck.hasAValidInsurrance) {
                        truckDataForDriver.hasValidTruck = true
                    }
                    return driverSnapshot.ref.set(truckDataForDriver, { merge: true })
                }))
            }
            promises.push(admin.database().ref(`/intents/add_technical_visit/${ref}/response`).ref.set({ code: 201 }))
            return Promise.all(promises)
        })

    static listenAddInsurranceIntent = functions.database.ref('/intents/add_insurrance/{ref}/finished')
        .onCreate(async (snapshot, context) => {
            if (!snapshot.val())
                return false
            const ref = context.params.ref

            const insurranceSnapshot = await admin.database().ref(`/intents/add_insurrance/${ref}`).once('value')
            const insurranceData = insurranceSnapshot.val()

            const truckSnapShot = await Trucks.getDocByRef(insurranceData.truck_ref)
            const repSnapShot = await Users.getDocByRef(insurranceData.user_ref)

            if (!truckSnapShot.data())
                return admin.database().ref(`/intents/add_insurrance/${ref}/response`).ref.set({ code: 404 })
            if (truckSnapShot.data().immatriculation.toLocaleLowerCase() !== insurranceData.immatriculation.toLocaleLowerCase())
                return admin.database().ref(`/intents/add_insurrance/${ref}/response`).ref.set({ code: 403 })
            if (!repSnapShot.data().is_ezy_rep)
                return admin.database().ref(`/intents/add_insurrance/${ref}/response`).ref.set({ code: 401 })
            const promises = []
            //move images to new endpoint 
            let image_path = insurranceData.image_url
            image_path = image_path.split("?")[0]
            const IMAGE_MV_PATH = `/trucks/${ref}/${truckSnapShot.id}/${image_path.split("/").pop()}`
            promises.push(File.moveFileFromTo(image_path, IMAGE_MV_PATH))
            // create tv doc
            const insurranceDoc = {
                imageUrl: IMAGE_MV_PATH,
                expirationDate: insurranceData.expiration_date,
                date: insurranceData.date,
                attestationNumber: insurranceData.attestation_number,
                provider: insurranceData.provider,
                createdAt: FieldValue.serverTimestamp(),
                updatedAt: FieldValue.serverTimestamp()
            }
            console.log(insurranceDoc)
            // store it to firestore
            promises.push(admin.firestore().collection(truckDocumentsPath + '/insurrances').add({
                ...insurranceDoc,
                addBy: insurranceData.user_ref,
                truckRef: insurranceData.truck_ref
            }))
            promises.push(truckSnapShot.ref.set({
                "insurrance": insurranceDoc,
                "hasAValidInsurrance": true,
            }, { merge: true }))
            // change status of car on driver document if truck currently have driver 
            if (truckSnapShot.data().hasCurrentDriver && truckSnapShot.data().driver_ref) {
                promises.push(Users.getDocByRef(truckSnapShot.data().driver_ref).then((driverSnapshot) => {
                    const truckDataForDriver = {
                        truck: {
                            hasAValidInsurrance: true
                        },
                        hasValidTruck: false
                    }
                    if (driverSnapshot.data().truck.hasValidTechnicalVisit && driverSnapshot.data().truck.hasValidRegistrationCertificate) {
                        truckDataForDriver.hasValidTruck = true
                    }
                    return driverSnapshot.ref.set(truckDataForDriver, { merge: true })
                }))
            }
            promises.push(admin.database().ref(`/intents/add_insurrance/${ref}/response`).ref.set({ code: 201 }))
            return Promise.all(promises)
        })

    static listenAddRegistrationCertificateIntent = functions.database.ref('/intents/add_registration_certificate/{ref}/finished')
        .onCreate(async (snapshot, context) => {
            if (!snapshot.val())
                return false
            const ref = context.params.ref

            const registrationCertificateSnapshot = await admin.database().ref(`/intents/add_registration_certificate/${ref}`).once('value')
            const registrationCertificateData = registrationCertificateSnapshot.val()

            const truckSnapShot = await Trucks.getDocByRef(registrationCertificateData.truck_ref)
            const repSnapShot = await Users.getDocByRef(registrationCertificateData.user_ref)

            if (!truckSnapShot.data())
                return admin.database().ref(`/intents/add_registration_certificate/${ref}/response`).ref.set({ code: 404 })
            if (truckSnapShot.data().immatriculation.toLocaleLowerCase() !== registrationCertificateData.immatriculation.toLocaleLowerCase())
                return admin.database().ref(`/intents/add_registration_certificate/${ref}/response`).ref.set({ code: 403 })
            if (!repSnapShot.data().is_ezy_rep)
                return admin.database().ref(`/intents/add_registration_certificate/${ref}/response`).ref.set({ code: 401 })
            const promises = []
            //move images to new endpoint 
            let image_path = registrationCertificateData.image_url
            image_path = image_path.split("?")[0]
            const IMAGE_MV_PATH = `/trucks/${ref}/${truckSnapShot.id}/${image_path.split("/").pop()}`
            promises.push(File.moveFileFromTo(image_path, IMAGE_MV_PATH))
            // create tv doc
            const registrationCertificateDoc = {
                imageUrl: IMAGE_MV_PATH,
                expirationDate: registrationCertificateData.expiration_date,
                date: registrationCertificateData.start_date,
                recordNumber: registrationCertificateData.record_number,
                serialNumber: registrationCertificateData.serial_number,
                createdAt: FieldValue.serverTimestamp(),
                updatedAt: FieldValue.serverTimestamp()
            }
            console.log(registrationCertificateDoc)
            // store it to firestore
            promises.push(admin.firestore().collection(truckDocumentsPath + '/registration_certificates').add({
                ...registrationCertificateDoc,
                addBy: registrationCertificateData.user_ref,
                truckRef: registrationCertificateData.truck_ref
            }))
            promises.push(truckSnapShot.ref.set({
                "registration_certificate": registrationCertificateDoc,
                "hasValidRegistrationCertificate": true,
            }, { merge: true }))
            // change status of car on driver document if truck currently have driver 
            if (truckSnapShot.data().hasCurrentDriver && truckSnapShot.data().driver_ref) {
                promises.push(Users.getDocByRef(truckSnapShot.data().driver_ref).then((driverSnapshot) => {
                    const truckDataForDriver = {
                        truck: {
                            hasValidRegistrationCertificate: true
                        },
                        hasValidTruck: false
                    }
                    if (driverSnapshot.data().truck.hasValidTechnicalVisit && driverSnapshot.data().truck.hasAValidInsurrance) {
                        truckDataForDriver.hasValidTruck = true
                    }
                    return driverSnapshot.ref.set(truckDataForDriver, { merge: true })
                }))
            }
            promises.push(admin.database().ref(`/intents/add_registration_certificate/${ref}/response`).ref.set({ code: 201 }))
            return Promise.all(promises)
        })
}