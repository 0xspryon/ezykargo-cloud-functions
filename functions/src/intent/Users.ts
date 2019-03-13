import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import { Users } from '../models';
const FieldValue = require('firebase-admin').firestore.FieldValue;

export class UsersIntent {

    static listenAddReview = functions.database.ref('/intents/add_review/{timestamp}/{ref}')
        .onCreate(async (snapshot, context) => {
            const firestore = admin.firestore()
            const realtimeDatabase = admin.database()

            const ref = context.params.ref
            const timestamp = context.params.timestamp

            const data = snapshot.val()


            return firestore.doc(data["userRef"]).get()
                .then(userDataSnapshot => {
                    const userData = userDataSnapshot.data()
                    console.log(userData)
                    return firestore.doc(Users.getRef(data["reviewFor"])).get()
                        .then(reviewForDataSnapshot => {
                            const reviewForData = reviewForDataSnapshot.data()
                            console.log(reviewForData)
                            return firestore.doc(data["freightageRef"]).get()
                                .then(freightageDataSnapshot => {
                                    const freightageData = freightageDataSnapshot.data()
                                    console.log(freightageData)
                                    if (freightageData["driversRefString"].indexOf(data["userRef"]) !== -1 && Users.getRef(data["reviewFor"]).indexOf(freightageData["userRef"])) {
                                        //is review for biz
                                        const average = ( +data.transparency+data.friendliness+data.promptness+data.correctness)/4;
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
                                                review_text: data["reviewText"],
                                                driver: false,
                                            })
                                            .then(()=>{
                                                let reviewCount = reviewForData.ratingCount || 0;
                                                let reviewTotalValue = reviewForData.reviewTotalValue || 0;
                                                reviewCount++;
                                                reviewTotalValue += average;
                                                return reviewForDataSnapshot.ref.set({
                                                    reviewCount: reviewCount,
                                                    reviewTotalValue: reviewTotalValue,
                                                    average_rating: reviewTotalValue/reviewCount
                                                }, { merge: true })
                                                .then(() => {
                                                    realtimeDatabase.ref(`/reviews/${userDataSnapshot.id}/${data["key"]}`).remove()
                                                    console.log("Success")
                                                    return realtimeDatabase.ref(`/intents/add_review/${timestamp}/${ref}/response/code`).ref
                                                        .set(201)
                                                });
                                            })
                                    }
                                    else if(data["userRef"].indexOf(freightageData["userRef"]) !== -1 && freightageData["driversRefString"].indexOf(Users.getRef(data["reviewFor"]))){
                                        //is review for driver
                                        const ratings = [
                                            +data.transparency,
                                            +data.friendliness,
                                            +data.promptness,
                                            +data.correctness,
                                        ]

                                        const average = ratings.reduce((a, b) => a+ b , 0)/ratings.length;
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
                                            .then(()=>{
                                                let reviewCount = reviewForData.ratingCount || 0;
                                                let reviewTotalValue = reviewForData.reviewTotalValue || 0;
                                                reviewCount++;
                                                reviewTotalValue += average;
                                                return reviewForDataSnapshot.ref.set({
                                                    reviewCount: reviewCount,
                                                    reviewTotalValue: reviewTotalValue,
                                                    average_rating: reviewTotalValue/reviewCount
                                                }, { merge: true })
                                                .then(() => {
                                                    realtimeDatabase.ref(`/reviews/${userDataSnapshot.id}/${data["key"]}`).remove()
                                                    console.log("Success")
                                                    return realtimeDatabase.ref(`/intents/add_review/${timestamp}/${ref}/response/code`).ref
                                                        .set(201)
                                                });
                                            })
                                    }else{
                                        console.log("Unauthorized", data)
                                        return realtimeDatabase.ref(`/intents/add_review/${timestamp}/${ref}/response/code`).ref
                                            .set(401)
                                    }
                                })
                                .catch((onrejected) => {
                                    console.log("Reject", onrejected)
                                    return realtimeDatabase.ref(`/intents/add_review/${timestamp}/${ref}/response/code`).ref
                                        .set( 404)
                                })
                        })
                        .catch((onrejected) => {
                            console.log("Reject", onrejected)
                            return realtimeDatabase.ref(`/intents/add_review/${timestamp}/${ref}/response/code`).ref
                                .set(404)
                        })
                 })
                 .catch((onrejected) => {
                     console.log("Reject", onrejected)
                     return realtimeDatabase.ref(`/intents/add_review/${timestamp}/${ref}/response/code`).ref
                         .set(404)
                });
        });
}