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
FreightagesIntent.listenAddFreightageIntent = functions.database.ref('/intents/add_freightage/{timestamp}/{ref}/finished')
    .onCreate((snapshot, context) => __awaiter(this, void 0, void 0, function* () {
    console.log(snapshot.val());
    if (!snapshot.val())
        return false;
    const ref = context.params.ref;
    const timestamp = context.params.timestamp;
    const freightageDataSnapshot = yield admin.database().ref(`/intents/add_freightage/${timestamp}/${ref}`).once('value');
    const freightageData = freightageDataSnapshot.val();
    //check if data is correct
    const response = yield models_1.Freightages.isValidFreightage(freightageData);
    if (response !== true) {
        // format response and put into rtdb
        admin.database().ref(`/intents/add_freightage/${timestamp}/${ref}`).ref.child("response")
            .set({ code: response });
        return false;
    }
    //create new freightage doc to store into firestore
    const promises = [];
    const freightageDoc = {
        arrival_date: +freightageData.arrival_date,
        arrival_time: freightageData.arrival_time,
        departure_date: +freightageData.departure_date,
        departure_time: freightageData.departure_time,
        car_pool: freightageData.car_pool,
        car_pool_number: (freightageData.car_pool) ? +freightageData.car_pool_number : 0,
        description: freightageData.description,
        from: freightageData.from,
        to: freightageData.to,
        userRef: freightageData.userRef,
        volume: +freightageData.volume,
        weight: +freightageData.weight,
        image: "",
        items: [],
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
        isDisabled: false,
        isDeleted: false
    };
    const uid = freightageDoc.userRef.split("/").pop();
    console.log("ici");
    Object.keys(freightageData.items).forEach(elt => {
        const item = freightageData.items[elt];
        const imagePath = item.imagePath;
        const newImagePath = `/freightages/${uid}/${imagePath.split("/").pop()}`;
        if (freightageDoc.image === "")
            freightageDoc.image = newImagePath;
        freightageDoc.items.push({
            imagePath: newImagePath,
            name: item.name,
            package_type: item.package_type,
            quantity: +item.quantity,
            weight: +item.weight,
            unity_name: item.unity_name,
        });
        promises.push(File_1.File.moveFileFromTo(imagePath, newImagePath));
    });
    const freightageRef = admin.firestore().collection(models_1.Freightages.basePath).doc();
    promises.push(freightageRef.set(freightageDoc).then(() => {
        return admin.firestore().runTransaction(t => {
            console.log("ici");
            const refFreightages = admin.firestore().doc(models_1.Freightages.bucketPath);
            console.log(refFreightages);
            console.log("la");
            return t.get(refFreightages).then((freightageListSnaphsot) => {
                console.log("ici là");
                const count = freightageListSnaphsot.data().freightagesCount + 1;
                console.log("ici là");
                return t.update(refFreightages, { freightagesCount: count });
            });
        }).then((onfullfilled) => {
            return admin.database().ref(`/intents/add_freightage/${timestamp}/${ref}`).ref.child("response")
                .set({ code: 201 });
        });
    }));
    Promise.all(promises).catch((err) => {
        console.log(err);
        admin.database().ref(`/intents/add_freightage/${timestamp}/${ref}`)
            .ref.child("response")
            .set({ code: 500 });
    });
}));
exports.FreightagesIntent = FreightagesIntent;
//# sourceMappingURL=Freightages.js.map