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
class TrucksIntent {
}
TrucksIntent.listenAddTruckIntent = functions.database.ref('/intents/add_truck/{uid}/{ref}/finished')
    .onUpdate((change, context) => __awaiter(this, void 0, void 0, function* () {
    const snapshot = change.after;
    if (!snapshot.val())
        return false;
    const uid = context.params.uid;
    const ref = context.params.ref;
    const truckDataSnapshot = yield admin.database().ref(`/intents/add_truck/${uid}/${ref}`).once('value');
    const truckData = truckDataSnapshot.val();
    console.log(truckData);
    //check if data is correct
    if (!models_1.Trucks.isValidTruck(truckData))
        // format response and put into rtdb
        return false;
    //create new truck doc to store into firestore
    const promises = [];
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
        owner_uid: models_1.Users.getRef(uid),
        driver_uid: models_1.Users.getRef(truckData.driver_uid),
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
        isDeleted: false
    };
    console.log(truckDoc);
    //foreach all images and push it move it to another location
    truckData.images.forEach(currentItem => {
        promises.push(File_1.File.moveFileFromTo(currentItem.path, `/trucks/${uid}/${currentItem.path.split("/").pop()}`));
    });
    promises.push(() => __awaiter(this, void 0, void 0, function* () {
        const truckRef = yield admin.firestore().collection(models_1.Trucks.basePath).add(truckDoc);
        const subPromises = [];
        truckData.images.forEach(currentItem => {
            subPromises.push(truckRef.collection("images").add({
                url: `/trucks/${uid}/${currentItem.path.split("/").pop()}`
            }));
        });
        subPromises.push(truckRef.collection('drivers').add({
            driver_uid: models_1.Users.getRef(truckData.driver_uid),
            amount: 0,
            idle: false
        }));
        return yield Promise.all(subPromises);
    }));
    promises.push(admin.firestore().doc(models_1.Trucks.bucketPath).get().then((trucksListSnaphsot) => {
        let count = 0;
        if (trucksListSnaphsot.data().trucksCount !== undefined && trucksListSnaphsot.data().trucksCount !== null)
            count = trucksListSnaphsot.data().trucksCount + 1;
        return trucksListSnaphsot.ref.set({ trucksCount: count }, { merge: true });
    }));
    // remove intention and evently add new response  
    promises.push(admin.database().ref(`/intents/add_truck/${uid}/${ref}`).remove());
    yield Promise.all(promises);
    return true;
}));
TrucksIntent.listenAddTechnicalVisitIntent = functions.database.ref('/intents/add_technical_visit/{uid}/{ref}/finished')
    .onUpdate((change, context) => __awaiter(this, void 0, void 0, function* () {
    const snapshot = change.after;
    if (!snapshot.val())
        return false;
    const uid = context.params.uid;
    const ref = context.params.ref;
    const tvSnapshot = yield admin.database().ref(`/intents/add_technical_visit/${uid}/${ref}`).once('value');
    const tvData = tvSnapshot.val();
    if (!models_1.Trucks.isValidTechnicalVisit(tvData))
        // format response and put into rtdb
        return false;
    const truckSnapShot = yield models_1.Trucks.getDoc(tvData.truck_id);
    //check if user is trucks owner
    if (truckSnapShot.data().owner_uid !== models_1.Users.getRef(uid))
        // format response and put into rtdb
        return false;
    const promises = [];
    //move images to new endpoint 
    const front_image_path = tvData.FRONT_IMAGE_URL.path;
    const back_image_path = tvData.BACK_IMAGE_URL.path;
    const FRONT_IMAGE_MV_PATH = `/trucks/${uid}/${truckSnapShot.id}/${front_image_path.split("/").pop()}`;
    const BACK_IMAGE_MV_PATH = `/trucks/${uid}/${truckSnapShot.id}/${back_image_path.split("/").pop()}`;
    promises.push(File_1.File.moveFileFromTo(front_image_path, FRONT_IMAGE_MV_PATH));
    promises.push(File_1.File.moveFileFromTo(back_image_path, BACK_IMAGE_MV_PATH));
    // create tv doc
    const tvDoc = {
        frontImageUrl: FRONT_IMAGE_MV_PATH,
        backImageUrl: BACK_IMAGE_MV_PATH,
        expirationDate: tvData.expirationDate,
        date: tvData.date,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp()
    };
    console.log(tvDoc);
    // store it to firestore
    promises.push(admin.firestore().collection(models_1.Trucks.getRef(truckSnapShot.id) + 'technical_visits').add(tvDoc));
    promises.push(admin.database().ref(`/intents/add_technical_visit/${uid}/${ref}`).remove());
    return Promise.all(promises);
}));
TrucksIntent.listenAddInsurranceIntent = functions.database.ref('/intents/add_insurrance/{uid}/{ref}/finished')
    .onUpdate((change, context) => __awaiter(this, void 0, void 0, function* () {
    const snapshot = change.after;
    if (!snapshot.val())
        return false;
    const uid = context.params.uid;
    const ref = context.params.ref;
    const insurranceSnapshot = yield admin.database().ref(`/intents/add_insurrance/${uid}/${ref}`).once('value');
    const insurranceData = insurranceSnapshot.val();
    if (!models_1.Trucks.isValidInsurrance(insurranceData))
        // format response and put into rtdb
        return false;
    const truckSnapShot = yield models_1.Trucks.getDoc(insurranceData.truck_id);
    //check if user is trucks owner
    if (truckSnapShot.data().owner_uid !== models_1.Users.getRef(uid))
        // format response and put into rtdb
        return false;
    const promises = [];
    //move images to new endpoint 
    const front_image_path = insurranceData.FRONT_IMAGE_URL.path;
    const back_image_path = insurranceData.BACK_IMAGE_URL.path;
    const FRONT_IMAGE_MV_PATH = `/trucks/${uid}/${truckSnapShot.id}/${front_image_path.split("/").pop()}`;
    const BACK_IMAGE_MV_PATH = `/trucks/${uid}/${truckSnapShot.id}/${back_image_path.split("/").pop()}`;
    promises.push(File_1.File.moveFileFromTo(front_image_path, FRONT_IMAGE_MV_PATH));
    promises.push(File_1.File.moveFileFromTo(back_image_path, BACK_IMAGE_MV_PATH));
    // create tv doc
    const insurranceDoc = {
        frontImageUrl: FRONT_IMAGE_MV_PATH,
        backImageUrl: BACK_IMAGE_MV_PATH,
        expirationDate: insurranceData.expirationDate,
        date: insurranceData.date,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp()
    };
    console.log(insurranceDoc);
    // store it to firestore
    promises.push(admin.firestore().collection(models_1.Trucks.getRef(truckSnapShot.id) + 'insurrance').add(insurranceDoc));
    promises.push(admin.database().ref(`/intents/add_insurrance/${uid}/${ref}`).remove());
    return Promise.all(promises);
}));
exports.TrucksIntent = TrucksIntent;
//# sourceMappingURL=Trucks.js.map