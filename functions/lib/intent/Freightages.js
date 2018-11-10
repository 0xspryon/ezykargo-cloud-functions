"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const admin = require("firebase-admin");
const functions = require("firebase-functions");
const File_1 = require("../utils/File");
const models_1 = require("../models");
const FieldValue = require('firebase-admin').firestore.FieldValue;
class FreightagesIntent {
}
/***
 * @ creates a new freightage request on the platform.
 * -Doesn't verify validity of data in the freightage request as that will be done with security rules.
 * -construct freightage document.
 * -move item images from path to the final resting point and register in constructed freightage doc
 * -save freightage doc to freightage list .then increment freightagesCount appropriately.
 * -save response code 201 ok or any corresponding erro-code
 */
FreightagesIntent.listenAddFreightageIntent = functions.database.ref('/intents/add_freightage/{timestamp}/{ref}/finished')
    .onCreate((snapshot, context) => __awaiter(this, void 0, void 0, function* () {
    const realtimeDatabase = admin.database();
    const firestore = admin.firestore();
    const intentData = snapshot.val();
    console.log(intentData);
    if (!intentData)
        return false;
    const ref = context.params.ref;
    const timestamp = context.params.timestamp;
    // const freightageDataSnapshot = await 
    return realtimeDatabase.ref(`/intents/add_freightage/${timestamp}/${ref}`).once('value', freightageDataSnapshot => {
        if (!freightageDataSnapshot.exists) {
            console.log("Data doesn't exists");
            realtimeDatabase.ref(`/intents/add_freightage/${timestamp}/${ref}`)
                .ref.child("response")
                .set({ code: 404 });
            return false;
        }
        const freightageData = freightageDataSnapshot.val();
        console.log(freightageData);
        const promises = [];
        const freightageDoc = Object.assign({}, freightageData, { arrival_date: +freightageData.arrival_date, departure_date: +freightageData.departure_date, departure_time: freightageData.departure_time, car_pool_number: (freightageData.car_pool) ? +freightageData.car_pool_number : 0, volume: +freightageData.volume, weight: +freightageData.weight, image: "", items: [], drivers: [], bargainers: [], createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(), isDeleted: false, onTransit: false, delivered: false, completed: false, idle: false, inBargain: true, pickup: false, relayCount: 0 });
        console.log(freightageDoc);
        const uid = freightageData.userRef.split("/").pop();
        const { items } = freightageData;
        const keys = Object.keys(items);
        keys.forEach(key => {
            const item = items[key];
            const imagePath = item.imagePath;
            const newImagePath = `/freightages/${uid}/${imagePath.split("/").pop()}`;
            if (!freightageDoc.image || freightageDoc.image === "")
                freightageDoc.image = newImagePath;
            freightageDoc.items.push(Object.assign({}, item, { imagePath: newImagePath, quantity: +item.quantity, weight: +item.weight }));
            promises.push(File_1.File.moveFileFromTo(imagePath, newImagePath));
        });
        const freightageRef = firestore.collection(models_1.Freightages.basePath).doc();
        const freightagesList = firestore.doc(models_1.Freightages.bucketPath);
        promises.push(new Promise((resolve, reject) => {
            freightageRef.set(freightageDoc).then(() => {
                freightagesList.get()
                    .then(freightagesListSnapshot => {
                    let freightagesCount = 0;
                    if (freightagesListSnapshot.exists)
                        freightagesCount = freightagesListSnapshot.get("freightagesCount");
                    freightagesCount = +freightagesCount + 1;
                    // console.log({ freightagesCount : freightagesListSnapshot.get("freightagesCount"), data: freightagesListSnapshot.data()})
                    freightagesList.set({ freightagesCount }, { merge: true })
                        .then(() => {
                        realtimeDatabase.ref(`/intents/add_freightage/${timestamp}/${ref}`).ref.child("response")
                            .set({ code: 201 }).then(() => {
                            resolve(true);
                        }).catch((err) => {
                            reject(err);
                        });
                    });
                });
            }).catch((err) => {
                reject(err);
            });
        }).catch((err) => {
            console.log(err);
            realtimeDatabase.ref(`/intents/add_freightage/${timestamp}/${ref}`)
                .ref.child("response")
                .set({ code: 500 });
        }));
        return Promise.all(promises);
    });
}));
FreightagesIntent.listenMarkAsPickup = functions.database.ref('/intents/{timestamp}/mark_as_pickup/{ref}')
    .onCreate((snapshot, context) => __awaiter(this, void 0, void 0, function* () {
    const firestore = admin.firestore();
    const realtimeDatabase = admin.database();
    const ref = context.params.ref;
    const timestamp = context.params.timestamp;
    const data = snapshot.val();
    firestore.doc(data["userRef"]).get()
        .then(userDataSnapshot => {
        const userData = userDataSnapshot.data();
        if (userData['transaction_pin_code'] !== "" + data["password"]) {
            realtimeDatabase.ref(`/intents/${timestamp}/mark_as_pickup/${ref}/response`).ref
                .set({ code: 403 });
            return;
        }
        firestore.doc(data["freightageRef"]).get()
            .then(freightageDataSnapshot => {
            const freightageData = freightageDataSnapshot.data();
            if (freightageData['driverRef'] !== "" + data["userRef"]) {
                realtimeDatabase.ref(`/intents/${timestamp}/mark_as_pickup/${ref}/response`).ref
                    .set({ code: 401 });
                return;
            }
            freightageDataSnapshot.ref.set({
                onTransit: true,
                pickup: false,
            }, { merge: true })
                .then(() => {
                realtimeDatabase.ref(`/intents/${timestamp}/mark_as_pickup/${ref}/response`).ref
                    .set({ code: 200 });
            })
                .catch((onrejected) => {
                console.log("Error on reject hire", onrejected);
                realtimeDatabase.ref(`/intents/${timestamp}/mark_as_pickup/${ref}/response`).ref
                    .set({ code: 500 });
            });
        })
            .catch((onrejected) => {
            console.log("Reject", onrejected);
            realtimeDatabase.ref(`/intents/${timestamp}/mark_as_pickup/${ref}/response`).ref
                .set({ code: 404 });
        });
    })
        .catch((onrejected) => {
        console.log("Reject", onrejected);
        realtimeDatabase.ref(`/intents/${timestamp}/mark_as_pickup/${ref}/response`).ref
            .set({ code: 404 });
    });
}));
FreightagesIntent.listenMarkAsDelivered = functions.database.ref('/intents/{timestamp}/mark_as_delivered/{ref}')
    .onCreate((snapshot, context) => __awaiter(this, void 0, void 0, function* () {
    const firestore = admin.firestore();
    const realtimeDatabase = admin.database();
    const ref = context.params.ref;
    const timestamp = context.params.timestamp;
    const data = snapshot.val();
    firestore.doc(data["userRef"]).get()
        .then(userDataSnapshot => {
        const userData = userDataSnapshot.data();
        if (userData['transaction_pin_code'] !== "" + data["password"]) {
            realtimeDatabase.ref(`/intents/${timestamp}/mark_as_delivered/${ref}/response`).ref
                .set({ code: 403 });
            return;
        }
        firestore.doc(data["freightageRef"]).get()
            .then(freightageDataSnapshot => {
            const freightageData = freightageDataSnapshot.data();
            if (freightageData['driverRef'] !== "" + data["userRef"]) {
                realtimeDatabase.ref(`/intents/${timestamp}/mark_as_delivered/${ref}/response`).ref
                    .set({ code: 401 });
                return;
            }
            freightageDataSnapshot.ref.set({
                onTransit: true,
                pickup: false,
            }, { merge: true })
                .then(() => {
                realtimeDatabase.ref(`/intents/${timestamp}/mark_as_delivered/${ref}/response`).ref
                    .set({ code: 200 });
            })
                .catch((onrejected) => {
                console.log("Error on reject hire", onrejected);
                realtimeDatabase.ref(`/intents/${timestamp}/mark_as_delivered/${ref}/response`).ref
                    .set({ code: 500 });
            });
        })
            .catch((onrejected) => {
            console.log("Reject", onrejected);
            realtimeDatabase.ref(`/intents/${timestamp}/mark_as_delivered/${ref}/response`).ref
                .set({ code: 404 });
        });
    })
        .catch((onrejected) => {
        console.log("Reject", onrejected);
        realtimeDatabase.ref(`/intents/${timestamp}/mark_as_delivered/${ref}/response`).ref
            .set({ code: 404 });
    });
}));
exports.FreightagesIntent = FreightagesIntent;
//# sourceMappingURL=Freightages.js.map