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
const models_1 = require("../models");
const FieldValue = require('firebase-admin').firestore.FieldValue;
class UsersIntent {
}
UsersIntent.listenAddReview = functions.database.ref('/intents/add_review/{timestamp}/{ref}')
    .onCreate((snapshot, context) => __awaiter(this, void 0, void 0, function* () {
    const firestore = admin.firestore();
    const realtimeDatabase = admin.database();
    const ref = context.params.ref;
    const timestamp = context.params.timestamp;
    const data = snapshot.val();
    return firestore.doc(data["userRef"]).get()
        .then(userDataSnapshot => {
        const userData = userDataSnapshot.data();
        console.log(userData);
        return firestore.doc(models_1.Users.getRef(data["reviewFor"])).get()
            .then(reviewForDataSnapshot => {
            const reviewForData = reviewForDataSnapshot.data();
            console.log(reviewForData);
            return firestore.doc(data["freightageRef"]).get()
                .then(freightageDataSnapshot => {
                const freightageData = freightageDataSnapshot.data();
                console.log(freightageData);
                if (data["userRef"].indexOf(freightageData["driverRef"]) !== -1 && models_1.Users.getRef(data["reviewFor"]).indexOf(freightageData["userRef"])) {
                    //is review for biz
                    let average = (+data.transparency + data.friendliness + data.promptness + data.correctness) / 4;
                    return reviewForDataSnapshot.ref
                        .collection('reviews').doc()
                        .set({
                        transparency: +data.transparency,
                        friendliness: +data.friendliness,
                        promptness: +data.promptness,
                        correctness: +data.correctness,
                        average: average,
                        createdAt: FieldValue.serverTimestamp(),
                        review_by: data["userRef"],
                        freightage_ref: data["freightageRef"],
                        avatarUrl: userData.avatarUrl,
                        fullName: userData.fullName,
                        texte: data["reviewText"],
                        driver: false,
                    })
                        .then(() => {
                        let reviewCount = reviewForData.ratingCount || 0;
                        let reviewTotalValue = reviewForData.reviewTotalValue || 0;
                        reviewCount++;
                        reviewTotalValue += average;
                        return reviewForDataSnapshot.ref.set({
                            reviewCount: reviewCount,
                            reviewTotalValue: reviewTotalValue,
                            average_rating: reviewTotalValue / reviewCount
                        }, { merge: true })
                            .then(() => {
                            realtimeDatabase.ref(`/reviews/${userDataSnapshot.id}/${data["key"]}`).remove();
                            console.log("Success");
                            return realtimeDatabase.ref(`/intents/add_review/${timestamp}/${ref}/response/code`).ref
                                .set(201);
                        });
                    });
                }
                else if (data["userRef"].indexOf(freightageData["userRef"]) !== -1 && models_1.Users.getRef(data["reviewFor"]).indexOf(freightageData["driverRef"])) {
                    //is review for driver
                    let average = (+data.transparency + data.friendliness + data.promptness + data.correctness) / 4;
                    return reviewForDataSnapshot.ref
                        .collection('reviews').doc()
                        .set({
                        transparency: +data.transparency,
                        friendliness: +data.friendliness,
                        promptness: +data.promptness,
                        correctness: +data.correctness,
                        average: average,
                        createdAt: FieldValue.serverTimestamp(),
                        review_by: data["userRef"],
                        freightage_ref: data["freightageRef"],
                        avatarUrl: userData.avatarUrl,
                        fullName: userData.fullName,
                        driver: true,
                    })
                        .then(() => {
                        let reviewCount = reviewForData.ratingCount || 0;
                        let reviewTotalValue = reviewForData.reviewTotalValue || 0;
                        reviewCount++;
                        reviewTotalValue += average;
                        return reviewForDataSnapshot.ref.set({
                            reviewCount: reviewCount,
                            reviewTotalValue: reviewTotalValue,
                            average_rating: reviewTotalValue / reviewCount
                        }, { merge: true })
                            .then(() => {
                            realtimeDatabase.ref(`/reviews/${userDataSnapshot.id}/${data["key"]}`).remove();
                            console.log("Success");
                            return realtimeDatabase.ref(`/intents/add_review/${timestamp}/${ref}/response/code`).ref
                                .set(201);
                        });
                    });
                }
                else {
                    console.log("Unauthorized");
                    return realtimeDatabase.ref(`/intents/add_review/${timestamp}/${ref}/response/code`).ref
                        .set(401);
                }
            })
                .catch((onrejected) => {
                console.log("Reject", onrejected);
                return realtimeDatabase.ref(`/intents/add_review/${timestamp}/${ref}/response/code`).ref
                    .set(404);
            });
        })
            .catch((onrejected) => {
            console.log("Reject", onrejected);
            return realtimeDatabase.ref(`/intents/add_review/${timestamp}/${ref}/response/code`).ref
                .set(404);
        });
    })
        .catch((onrejected) => {
        console.log("Reject", onrejected);
        return realtimeDatabase.ref(`/intents/add_review/${timestamp}/${ref}/response/code`).ref
            .set(404);
    });
}));
exports.UsersIntent = UsersIntent;
//# sourceMappingURL=Users.js.map