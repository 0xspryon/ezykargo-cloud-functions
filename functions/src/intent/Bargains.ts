import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import { Freightages, Users } from '../models';
import { isArray } from 'util';
const crypto = require("crypto")
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
            const intentData = snapshot.val()
            console.log(intentData.drivers,intentData)
            firestore.doc(Freightages.getRef(freightageRef)).get()
                .then(freightageDataSnapshot => {
                    const drivers  = []
                    const bargains = []
                    intentData.drivers.map((d)=>{
                        const driver = d
                        const uniqID = crypto.randomBytes(16).toString("hex")
                        driver["uniqID"] = uniqID
                        if(driver.pool){
                            driver.drivers = driver.drivers.map((sub_driver,index)=>{
                                drivers.push({...sub_driver,price: driver.price,userRef: sub_driver.driverRef,pool: true, uniqID:uniqID})
                                return {...sub_driver,idle:true,userRef: sub_driver.driverRef}
                            });
                        }else{
                            driver.idle = true
                            drivers.push(driver)
                        }
                        bargains.push(driver)
                        return driver
                    })
                    console.log({
                        bargains: bargains,
                        drivers: drivers.map((driver) => {
                            console.log(driver)
                            return {
                                driverRef: driver.userRef, 
                                price: driver.price, 
                                idle: true,
                                avatarUrl: driver.avatarUrl,
                                uniqID: driver.uniqID,
                                reviews_avg: driver.reviews_avg,
                                fullName: driver.name || driver.fullName
                            }
                        }),
                        driversRefString: drivers.map((driver) => {
                            return driver.userRef
                        }),
                        idle: true,
                        inBargain: false,
                    })
                    freightageDataSnapshot.ref.set({
                        bargains: bargains,
                        drivers: drivers.map((driver) => {
                            console.log(driver)
                            return {
                                driverRef: driver.userRef, 
                                price: driver.price, 
                                idle: true,
                                avatarUrl: driver.avatarUrl,
                                uniqID: driver.uniqID,
                                reviews_avg: driver.reviews_avg,
                                fullName: driver.name || driver.fullName
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

        })

    static listenPostResponseForHireDriver = functions.database.ref('/intents/{timestamp}/accepted_hired_request/{freightageRef}/{userRef}/')
        .onCreate(async (snapshot, context) => {
            const firestore = admin.firestore()
            const realtimeDatabase = admin.database()

            const freightageRef = context.params.freightageRef
            const userRef = context.params.userRef
            const timestamp = context.params.timestamp

            const postData = snapshot.val()
            //get freightage 
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
                    //check if freightage still in idle status 
                    if(!freightageData.idle){
                        realtimeDatabase.ref(`/intents/${timestamp}/accepted_hired_request/${freightageRef}/${userRef}/response`).ref
                            .set({ code: 403 })
                        return;
                    }
                    drivers = drivers.map((driver) => {
                        if (Users.getRef(userRef).indexOf(driver.driverRef) !== -1) {
                            if(postData.selectedBargain.indexOf(driver.uniqID) !== -1)
                                driver.idle = false
                        }
                        return driver;
                    });
                    //when user reject request
                    if (!postData.accepted) {
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
                                    } else {
                                        const driverDoc = userDataSnapshot.data()
                                        console.log(driverDoc.truck)
                                        //check if drivers have a valid truck 
                                        if(!driverDoc.truck)
                                            return realtimeDatabase.ref(`/intents/${timestamp}/accepted_hired_request/${freightageRef}/${userRef}/response`).ref
                                                .set({ code: 403 })
                                        //check if is pool or simple bargain if is pool make other check
                                        let bargains = freightageData.bargains || [];
                                        let selectedBargain;
                                        let isFinish = false;
                                        let selectedDrivers = []
                                        bargains = bargains.map(bargain=>{
                                            if(isFinish)
                                                return bargain
                                            if (postData.selectedBargain.indexOf(bargain.uniqID)!==-1){
                                                if(bargain.pool){
                                                    let totalAvailableWeight = 0
                                                    let myWeight = 0
                                                    const subSelectedDriver = []
                                                    bargain.drivers = bargain.drivers.map(driver=>{
                                                        if(!driver.idle && Users.getRef(userRef).indexOf(driver.userRef) === -1){
                                                            totalAvailableWeight += driver.carring_capacity
                                                            subSelectedDriver.push({
                                                                driverRef: driver.userRef, price: bargain.price,
                                                                avatarUrl: driver.avatarUrl,
                                                                uniqID: bargain.uniqID,
                                                                truckRef: driverDoc.truck.truckRef,
                                                                carring_capacity: driver.carring_capacity,
                                                                reviews_avg: driver.reviews_avg,
                                                                fullName: driver.name || driver.fullName
                                                            })
                                                        }
                                                        if(Users.getRef(userRef).indexOf(driver.userRef)!==-1){
                                                            driver.truckRef = driverDoc.truck.truckRef
                                                            if(driver.idle){
                                                                myWeight = driver.carring_capacity
                                                                driver.idle = false
                                                                subSelectedDriver.push({
                                                                    driverRef: driver.userRef, price: bargain.price,
                                                                    avatarUrl: driver.avatarUrl,
                                                                    uniqID: bargain.uniqID,
                                                                    truckRef: driverDoc.truck.truckRef,
                                                                    carring_capacity: driverDoc.truck.carring_capacity,
                                                                    carrying_capacity: driverDoc.truck.carrying_capacity,
                                                                    reviews_avg: driver.reviews_avg,
                                                                    fullName: driver.name || driver.fullName
                                                                })
                                                            }
                                                        }
                                                        return driver;
                                                    })
                                                    if(totalAvailableWeight>=freightageData.weight){
                                                        return realtimeDatabase.ref(`/intents/${timestamp}/accepted_hired_request/${freightageRef}/${userRef}/response`).ref
                                                            .set({ code: 403 })
                                                    }else if(totalAvailableWeight + myWeight >= freightageData.weight){
                                                        isFinish = true
                                                        selectedDrivers = subSelectedDriver
                                                        selectedBargain = bargain
                                                    }
                                                }else{
                                                    isFinish = true
                                                    selectedBargain = Object.assign({},bargain)
                                                    selectedDrivers.push({
                                                        driverRef: bargain.userRef, 
                                                        price: bargain.price,
                                                        avatarUrl: bargain.avatarUrl,
                                                        uniqID: bargain.uniqID,
                                                        truckRef: driverDoc.truck.truckRef,
                                                        carring_capacity: driverDoc.truck.carrying_capacity,
                                                        carrying_capacity: driverDoc.truck.carrying_capacity,
                                                        reviews_avg: bargain.reviews_avg,
                                                        fullName: bargain.name || bargain.fullName
                                                    })
                                                }
                                            }
                                            return bargain
                                        })
                                        console.log(selectedBargain)
                                        console.log(isFinish)
                                        // define new data structure to update
                                        let dataToUpdate 
                                        if(isFinish){
                                            dataToUpdate = {
                                                pickup: true,
                                                idle: false, 
                                                inBargain: false,
                                                amount: selectedBargain.price,
                                                bargains,
                                                drivers: selectedDrivers,
                                                driversRefString: selectedDrivers.map((driver) => {
                                                    return driver.driverRef
                                                }),
                                            }
                                        }else{
                                            dataToUpdate = {
                                                bargains,
                                                drivers
                                            }
                                        }
                                        console.log(dataToUpdate)
                                        //update freightage and pass it to pickup and send notification to all user depend on status 
                                        return freightageDataSnapshot.ref.set(dataToUpdate, { merge: true })
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