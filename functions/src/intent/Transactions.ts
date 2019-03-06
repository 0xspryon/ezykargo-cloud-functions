import * as admin from "firebase-admin";
import * as functions from "firebase-functions";
import { Transactions } from "../models";
import {
  cloud_function_url_notification,
  placePayment,
  serviceKey
} from "../api";
const FieldValue = require("firebase-admin").firestore.FieldValue;
// const axios = require('axios');
const rp = require("request-promise");

export class TransactionsIntent {
  static listenMakePayment = functions.database
    .ref("/intents/make_deposit/{timestamp}/{ref}")
    .onCreate(async (snapshot, context) => {
      const firestore = admin.firestore();
      const realtimeDatabase = admin.database();

      const ref = context.params.ref;
      const timestamp = context.params.timestamp;

      const data = snapshot.val();

      firestore
        .doc(data["userRef"])
        .get()
        .then(userDataSnapshot => {
          if (!userDataSnapshot.exists) {
            realtimeDatabase
              .ref(`/intents/make_deposit/${timestamp}/${ref}/response/code`)
              .ref.set(404);
            return;
          }
          const userData = userDataSnapshot.data();
          const transactionRef = firestore
            .collection(Transactions.basePath)
            .doc();
          const requestData = {
            service: serviceKey,
            phonenumber: data["phoneNumber"] + "",
            amount: data["amount"],
            notify_url: cloud_function_url_notification,
            item_ref: `/intents/make_deposit/${timestamp}/${ref}/`,
            payment_ref: transactionRef.path,
            user: data["userRef"],
            first_name: userData.firstName,
            last_name: userData.fullName
          };
          if (data["operator"] && data["operator"] === "CM_EUMM") {
            requestData["operator"] = "CM_EUMM";
          }
          console.log(requestData, placePayment);
          const options = {
            method: "POST",
            uri: placePayment,
            json: true,
            body: { ...requestData }
          };

          return rp(options)
            .then(result => {
              console.log(result);
              transactionRef
                .set({
                  ...requestData,
                  ...result,
                  createdAt: FieldValue.serverTimestamp(),
                  type: "deposit"
                })
                .then(() => {
                  console.log(result);
                  if (result.status === "REQUEST_ACCEPTED") {
                    realtimeDatabase
                      .ref(`/intents/make_deposit/${timestamp}/${ref}/response`)
                      .ref.set({
                        code: 202,
                        response: result
                      });
                  } else if (result.status === "INVALID_MSISDN") {
                    realtimeDatabase
                      .ref(`/intents/make_deposit/${timestamp}/${ref}/response`)
                      .ref.set({
                        code: 400,
                        response: result
                      });
                  } else {
                    realtimeDatabase
                      .ref(`/intents/make_deposit/${timestamp}/${ref}/response`)
                      .ref.set({
                        code: 503,
                        response: result
                      });
                  }
                })
                .catch(onrejected => {
                  realtimeDatabase
                    .ref(
                      `/intents/make_deposit/${timestamp}/${ref}/response/code`
                    )
                    .ref.set(500);
                });
            })
            .catch(error => {
              console.log(error);
              realtimeDatabase
                .ref(`/intents/make_deposit/${timestamp}/${ref}/response/code`)
                .ref.set(503);
            });
        })
        .catch(onrejected => {
          console.log("Reject", onrejected);
          realtimeDatabase
            .ref(`/intents/make_deposit/${timestamp}/${ref}/response/code`)
            .ref.set(404);
        });
    });

  static validatePayment(data) {
    return new Promise((resolve, reject) => {
      const firestore = admin.firestore();
      const realtimeDatabase = admin.database();
      firestore
        .doc(data.payment_ref)
        .get()
        .then(transactionDataSnapshot => {
          if (!transactionDataSnapshot.exists) {
            reject(404);
            return;
          }
          const transactionData = transactionDataSnapshot.data();
          const item_ref = data["item_ref"];
          delete data["service"];
          delete data["payment_ref"];
          delete data["item_ref"];
          const userId = transactionData["user"].split("/").pop();
          firestore
            .doc(Transactions.getRefMoneyAccount(userId))
            .get()
            .then(dataSnapshot => {
              let account;
              if (dataSnapshot.exists) {
                account = dataSnapshot.data();
              } else {
                account = {
                  balance: 0,
                  withdrawCount: 0,
                  depositCount: 0,
                  referralCommissionCount: 0
                };
              }
              let newVal = {};
              if (data.data === "success") {
                newVal = {
                  prevAmount: +account["balance"],
                  newAmount: account["balance"] + transactionData
                };
              }
              transactionDataSnapshot.ref
                .set({ ...data, ...newVal }, { merge: true })
                .then(() => {
                  if (data.data === "failed") {
                    realtimeDatabase
                      .ref(`${item_ref}`)
                      .ref.child("response")
                      .set({ code: 406 });
                  } else if (data.data === "cancelled") {
                    realtimeDatabase
                      .ref(`${item_ref}`)
                      .ref.child("response")
                      .set({ code: 412 });
                  } else if (data.data === "success") {
                    if (dataSnapshot.exists) {
                      transactionDataSnapshot.ref
                        .set(
                          {
                            ...account,
                            balance: account["balance"] + transactionData
                          },
                          { merge: true }
                        )
                        .then(() => {
                          realtimeDatabase
                            .ref(`${item_ref}`)
                            .ref.child("response")
                            .set({ code: 201 });
                          resolve(202);
                        });
                    } else {
                      transactionDataSnapshot.ref
                        .set({
                          ...account,
                          balance: account["balance"] + transactionData
                        })
                        .then(() => {
                          realtimeDatabase
                            .ref(`${item_ref}`)
                            .ref.child("response")
                            .set({ code: 201 });
                          resolve(202);
                        });
                    }
                  }
                });
            });
        })
        .catch(onrejected => {
          reject(500);
        });
    });
  }
}
