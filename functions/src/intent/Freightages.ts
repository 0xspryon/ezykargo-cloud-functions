import * as admin from "firebase-admin";
import * as functions from "firebase-functions";
import { File } from "../utils/File";
import { Freightages } from "../models";
const FieldValue = require("firebase-admin").firestore.FieldValue;

export class FreightagesIntent {
  /***
   * @ creates a new freightage request on the platform.
   * -Doesn't verify validity of data in the freightage request as that will be done with security rules.
   * -construct freightage document.
   * -move item images from path to the final resting point and register in constructed freightage doc
   * -save freightage doc to freightage list .then increment freightagesCount appropriately.
   * -save response code 201 ok or any corresponding erro-code
   */
  static listenAddFreightageIntent = functions.database
    .ref("/intents/add_freightage/{timestamp}/{ref}/finished")
    .onCreate(async (snapshot, context) => {
      const realtimeDatabase = admin.database();
      const firestore = admin.firestore();

      const intentData = snapshot.val();
      console.log(intentData);
      if (!intentData) return false;

      const ref = context.params.ref;
      const timestamp = context.params.timestamp;

      // const freightageDataSnapshot = await
      return realtimeDatabase
        .ref(`/intents/add_freightage/${timestamp}/${ref}`)
        .once("value", freightageDataSnapshot => {
          if (!freightageDataSnapshot.exists) {
            console.log("Data doesn't exists");
            realtimeDatabase
              .ref(`/intents/add_freightage/${timestamp}/${ref}`)
              .ref.child("response")
              .set({ code: 404 });
            return false;
          }
          const freightageData = freightageDataSnapshot.val();
          console.log(freightageData);

          const promises = [];
          const freightageDoc = {
            ...freightageData,
            arrival_date: +freightageData.arrival_date,
            departure_date: +freightageData.departure_date,
            // departure_time: freightageData.departure_time,
            // car_pool_number: (freightageData.car_pool) ? +freightageData.car_pool_number : 0,
            volume: +freightageData.volume,
            weight: +freightageData.weight,
            image: "",
            items: [],
            drivers: [],
            bargainers: [],
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
            isDeleted: false,
            onTransit: false,
            delivered: false,
            completed: false,
            idle: false,
            inBargain: true,
            pickup: false,
            relayCount: 0
          };
          console.log(freightageDoc);
          const uid = freightageData.userRef.split("/").pop();
          const { items } = freightageData;
          const keys = Object.keys(items);
          keys.forEach(key => {
            const item = items[key];
            const imagePath = item.imagePath;
            const newImagePath = `/freightages/${uid}/${imagePath
              .split("/")
              .pop()}`;
            if (!freightageDoc.image || freightageDoc.image === "")
              freightageDoc.image = newImagePath;
            freightageDoc.items.push({
              ...item,
              imagePath: newImagePath,
              quantity: +item.quantity,
              weight: +item.weight
            });
            promises.push(File.moveFileFromTo(imagePath, newImagePath));
          });

          const freightageRef = firestore
            .collection(Freightages.basePath)
            .doc();
          const freightagesList = firestore.doc(Freightages.bucketPath);
          promises.push(
            new Promise((resolve, reject) => {
              freightageRef
                .set(freightageDoc)
                .then(() => {
                  freightagesList.get().then(freightagesListSnapshot => {
                    let freightagesCount = 0;
                    if (freightagesListSnapshot.exists)
                      freightagesCount = freightagesListSnapshot.get(
                        "freightagesCount"
                      );
                    freightagesCount = +freightagesCount + 1;
                    // console.log({ freightagesCount : freightagesListSnapshot.get("freightagesCount"), data: freightagesListSnapshot.data()})
                    freightagesList
                      .set({ freightagesCount }, { merge: true })
                      .then(() => {
                        // inscrement number of freigt in rtdb
                        const departure_date = freightageData.departure_date;
                        realtimeDatabase
                          .ref(
                            `/cities/${
                              freightageData.addressFrom.mLocality
                            }/${departure_date}/${
                              freightageData.addressTo.mLocality
                            }`
                          )
                          .once(
                            "value",
                            cityvalue => {
                              if (cityvalue.val()) {
                                realtimeDatabase
                                  .ref(
                                    `/cities/${
                                      freightageData.addressFrom.mLocality
                                    }/${departure_date}/${
                                      freightageData.addressTo.mLocality
                                    }`
                                  )
                                  .ref.set({
                                    number: cityvalue.val().number + 1,
                                    weight:
                                      +freightageData.weight +
                                      cityvalue.val().weight
                                  });
                              } else {
                                realtimeDatabase
                                  .ref(
                                    `/cities/${
                                      freightageData.addressFrom.mLocality
                                    }/${departure_date}/${
                                      freightageData.addressTo.mLocality
                                    }`
                                  )
                                  .ref.set({
                                    number: 1,
                                    weight: +freightageData.weight
                                  });
                              }
                              realtimeDatabase
                                .ref(
                                  `/intents/add_freightage/${timestamp}/${ref}`
                                )
                                .ref.child("response")
                                .set({ code: 201 })
                                .then(() => {
                                  resolve(true);
                                })
                                .catch(err => {
                                  reject(err);
                                });
                            },
                            () => {
                              realtimeDatabase
                                .ref(
                                  `/cities/${
                                    freightageData.addressFrom.mLocality
                                  }/${departure_date}/${
                                    freightageData.addressTo.mLocality
                                  }`
                                )
                                .ref.set({
                                  number: 1,
                                  weight: +freightageData.weight
                                });
                              realtimeDatabase
                                .ref(
                                  `/intents/add_freightage/${timestamp}/${ref}`
                                )
                                .ref.child("response")
                                .set({ code: 201 })
                                .then(() => {
                                  resolve(true);
                                })
                                .catch(err => {
                                  reject(err);
                                });
                            }
                          );
                      });
                  });
                })
                .catch(err => {
                  reject(err);
                });
            }).catch(err => {
              console.log(err);
              realtimeDatabase
                .ref(`/intents/add_freightage/${timestamp}/${ref}`)
                .ref.child("response")
                .set({ code: 500 });
            })
          );

          return Promise.all(promises);
        });
    });

  static listenMarkAsDelivered = functions.database
    .ref("/intents/{timestamp}/mark_as_delivered/{ref}")
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
          const userData = userDataSnapshot.data();
          if (userData["transaction_pin_code"] !== "" + data["password"]) {
            realtimeDatabase
              .ref(`/intents/${timestamp}/mark_as_delivered/${ref}/response`)
              .ref.set({ code: 403 });
            return;
          }
          firestore
            .doc(data["freightageRef"])
            .get()
            .then(freightageDataSnapshot => {
              const freightageData = freightageDataSnapshot.data();
              const driverFound = freightageData.drivers.find(
                driver => data["userRef"].indexOf(driver.driverRef) !== -1
              );
              console.log(driverFound);
              if (!driverFound) {
                realtimeDatabase
                  .ref(
                    `/intents/${timestamp}/mark_as_delivered/${ref}/response`
                  )
                  .ref.set({ code: 401 });
                return;
              }
              const supData = {
                onTransit: false,
                pickup: false,
                deliveredAt: null
              };

              const drivers = freightageData.drivers.map(driver => {
                if (data["userRef"].indexOf(driver.driverRef) !== -1) {
                  driver.onTransit = false;
                  driver.delivery = true;
                }
                if (
                  driver.pickup &&
                  !(driver.onTransit || driver.delivery || driver.completed)
                )
                  supData.pickup = true;
                if (driver.onTransit) supData.onTransit = true;
                // if (!driver.delivery) supData.onTransit = true;
                return driver;
              });

              if (!supData.onTransit)
                supData.deliveredAt = FieldValue.serverTimestamp();

              freightageDataSnapshot.ref
                .set(
                  {
                    ...supData,
                    delivered: true,
                    drivers: drivers
                  },
                  { merge: true }
                )
                .then(() => {
                  realtimeDatabase
                    .ref(
                      `/intents/${timestamp}/mark_as_delivered/${ref}/response`
                    )
                    .ref.set({ code: 200 });
                })
                .catch(onrejected => {
                  console.log("Error on reject hire", onrejected);
                  realtimeDatabase
                    .ref(
                      `/intents/${timestamp}/mark_as_delivered/${ref}/response`
                    )
                    .ref.set({ code: 500 });
                });
            })
            .catch(onrejected => {
              console.log("Reject", onrejected);
              realtimeDatabase
                .ref(`/intents/${timestamp}/mark_as_delivered/${ref}/response`)
                .ref.set({ code: 404 });
            });
        })
        .catch(onrejected => {
          console.log("Reject", onrejected);
          realtimeDatabase
            .ref(`/intents/${timestamp}/mark_as_delivered/${ref}/response`)
            .ref.set({ code: 404 });
        });
    });

  static listenMarkAsCompleted = functions.database
    .ref("/intents/{timestamp}/mark_as_completed/{ref}")
    .onCreate(async (snapshot, context) => {
      const firestore = admin.firestore();
      const realtimeDatabase = admin.database();

      const ref = context.params.ref;
      const timestamp = context.params.timestamp;

      const data = snapshot.val();

      return firestore
        .doc(data["userRef"])
        .get()
        .then(userDataSnapshot => {
          const userData = userDataSnapshot.data();
          if (userData["transaction_pin_code"] !== "" + data["password"]) {
            return realtimeDatabase
              .ref(`/intents/${timestamp}/mark_as_completed/${ref}/response`)
              .ref.set({ code: 403 });
          }
          return firestore
            .doc(data["freightageRef"])
            .get()
            .then(freightageDataSnapshot => {
              const freightageData = freightageDataSnapshot.data();

              if (freightageData["userRef"] !== "" + data["userRef"]) {
                return realtimeDatabase
                  .ref(
                    `/intents/${timestamp}/mark_as_completed/${ref}/response`
                  )
                  .ref.set({ code: 401 });
              }

              const driverFound = freightageData.drivers.find(
                driver => data["driverRef"].indexOf(driver.driverRef) !== -1
              );
              console.log(driverFound);
              if (!driverFound) {
                return realtimeDatabase
                  .ref(
                    `/intents/${timestamp}/mark_as_completed/${ref}/response`
                  )
                  .ref.set({ code: 404 });
              }

              const supData = {
                delivered: false,
                onTransit: false,
                pickup: false,
                completedAt: null
              };

              let driverSelected;

              const drivers = freightageData.drivers.map(driver => {
                if (data["driverRef"].indexOf(driver.driverRef) !== -1) {
                  driver.completed = true;
                  driver.delivery = false;
                  driver.onTransit = false;
                  driverSelected = driver;
                }
                if (
                  driver.pickup &&
                  !(driver.onTransit || driver.delivery || driver.completed)
                )
                  supData.pickup = true;
                if (driver.onTransit) supData.onTransit = true;
                if (driver.delivery) supData.delivered = true;
                return driver;
              });

              if (!supData.delivered && !supData.onTransit && !supData.pickup)
                supData.completedAt = FieldValue.serverTimestamp();

              return freightageDataSnapshot.ref
                .set(
                  {
                    ...supData,
                    completed: true,
                    drivers: drivers
                  },
                  { merge: true }
                )
                .then(() => {
                  const promises = [];
                  if (
                    !supData.delivered &&
                    !supData.onTransit &&
                    !supData.pickup
                  ) {
                    realtimeDatabase
                      .ref(
                        `/intents/freightage_complete/${timestamp}/${
                          freightageDataSnapshot.id
                        }`
                      )
                      .ref.set(
                        `/bucket/moneyAccount/moneyAccounts/${
                          userDataSnapshot.id
                        }/escrow/${freightageDataSnapshot.id}`
                      );
                  }
                  // freightageData.drivers.forEach((driver)=>{
                  promises.push(
                    firestore
                      .doc(driverSelected.driverRef)
                      .get()
                      .then(driverDataSnapshot => {
                        const driverData = driverDataSnapshot.data();
                        console.log(driverData);
                        const userReview = {
                          avatarUrl: userData.avatarUrl,
                          fullName: userData.fullName,
                          average_rating: userData.average_rating,
                          departure_date: freightageData.departure_date,
                          amount: freightageData.amount,
                          from: freightageData.from,
                          to: freightageData.to,
                          title: freightageData.title,
                          freightageRef: data["freightageRef"],
                          userId: userDataSnapshot.id
                        };
                        const driverReview = {
                          avatarUrl: driverData.avatarUrl,
                          fullName: driverData.fullName,
                          average_rating: driverData.average_rating,
                          departure_date: freightageData.departure_date,
                          amount: freightageData.amount,
                          from: freightageData.from,
                          to: freightageData.to,
                          title: freightageData.title,
                          freightageRef: data["freightageRef"],
                          userId: driverDataSnapshot.id
                        };
                        realtimeDatabase
                          .ref(`/reviews/${userDataSnapshot.id}/${timestamp}`)
                          .ref.set(driverReview)
                          .then(() => {
                            return realtimeDatabase
                              .ref(
                                `/reviews/${driverDataSnapshot.id}/${timestamp}`
                              )
                              .ref.set(userReview);
                          })
                          .catch(onrejected => {
                            console.log("REVIEW", onrejected);
                            return realtimeDatabase
                              .ref(
                                `/intents/${timestamp}/mark_as_completed/${ref}/response`
                              )
                              .ref.set({ code: 404 });
                          });
                      })
                  );
                  // })
                  return Promise.all(promises)
                    .then(() => {
                      return realtimeDatabase
                        .ref(
                          `/intents/${timestamp}/mark_as_completed/${ref}/response/code`
                        )
                        .ref.set(200);
                    })
                    .catch(onrejected => {
                      console.log("Error on reject hire", onrejected);
                      return realtimeDatabase
                        .ref(
                          `/intents/${timestamp}/mark_as_completed/${ref}/response`
                        )
                        .ref.set({ code: 500 });
                    });
                  // } else {
                  //   return realtimeDatabase
                  //     .ref(
                  //       `/intents/${timestamp}/mark_as_completed/${ref}/response/code`
                  //     )
                  //     .ref.set(200);
                  // }
                })
                .catch(onrejected => {
                  console.log("Reject", onrejected);
                  return realtimeDatabase
                    .ref(
                      `/intents/${timestamp}/mark_as_completed/${ref}/response`
                    )
                    .ref.set({ code: 404 });
                });
            });
        });
    });
}
