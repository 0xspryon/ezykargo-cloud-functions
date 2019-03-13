import * as admin from "firebase-admin";
import * as functions from "firebase-functions";
import { Freightages, Users } from "../models";

export class PickupsIntent {
  /**
   * 1- get freightage
   * 2- get drivers and check if user is driver
   * 3- check if user allready mark as pickup
   * 3- check if quantity mark is small than rest of quantity
   * 4- if all is correct mark as pickup
   * 5- send fcm to biz
   */
  static listenMarkAsPickup = functions.database
    .ref("/intents/mark_as_pickup/{timestamp}/{freightageRef}/{userRef}")
    .onCreate(async (snapshot, context) => {
      const firestore = admin.firestore();
      const realtimeDatabase = admin.database();

      const freightageRef = context.params.freightageRef;
      const userRef = context.params.userRef;
      const timestamp = context.params.timestamp;

      const postData = snapshot.val();
      /** Step 1 */
      firestore
        .doc(Users.getRef(userRef))
        .get()
        .then(async userDataSnapshot => {
          const userData = userDataSnapshot.data();
          console.log(userData);
          if (
            userData["transaction_pin_code"] + "" !==
            "" + postData["password"]
          ) {
            return realtimeDatabase
              .ref(
                `/intents/mark_as_pickup/${timestamp}/${freightageRef}/${userRef}/response`
              )
              .ref.set({ code: 403 });
          }
          await firestore
            .runTransaction(t => {
              return t
                .get(firestore.doc(Freightages.getRef(freightageRef)))
                .then(freightageDataSnapshot => {
                  const freightageData = freightageDataSnapshot.data();
                  /** Step 2 */
                  const driverFound = freightageData.drivers.find(
                    driver =>
                      Users.getRef(userRef).indexOf(driver.driverRef) !== -1
                  );
                  if (!driverFound) {
                    return realtimeDatabase
                      .ref(
                        `/intents/mark_as_pickup/${timestamp}/${freightageRef}/${userRef}/response`
                      )
                      .ref.set({ code: 403 });
                  }
                  if (
                    driverFound.pickup ||
                    (driverFound.items && driverFound.items.length !== 0)
                  )
                    return realtimeDatabase
                      .ref(
                        `/intents/mark_as_pickup/${timestamp}/${freightageRef}/${userRef}/response`
                      )
                      .ref.set({ code: 409 });
                  /** Step 3 */
                  const new_items = freightageData.items;
                  const carrying_items = [];
                  let quantity_mismatch = false;
                  postData.items.forEach(item => {
                    const remote_item = new_items[item.index];
                    if (!remote_item.carrying_quantity)
                      remote_item.carrying_quantity = 0;
                    if (
                      item.quantity >
                      remote_item.quantity - remote_item.carrying_quantity
                    ) {
                      quantity_mismatch = true;
                    }
                    remote_item.carrying_quantity += item.quantity;
                    carrying_items.push({
                      ...remote_item,
                      carrying_quantity: item.quantity,
                      index: item.index
                    });
                  });

                  if (quantity_mismatch)
                    return realtimeDatabase
                      .ref(
                        `/intents/mark_as_pickup/${timestamp}/${freightageRef}/${userRef}/response`
                      )
                      .ref.set({ code: 404 });
                  /** Step 4 */
                  return freightageDataSnapshot.ref
                    .set(
                      {
                        items: new_items,
                        drivers: freightageData.drivers.map(driver => {
                          if (
                            Users.getRef(userRef).indexOf(driver.driverRef) !==
                            -1
                          ) {
                            driver.items = carrying_items;
                            driver.pickup = false;
                          }
                          return driver;
                        })
                      },
                      { merge: true }
                    )
                    .then(() => {
                      /** Step 5 */
                      //send fcm
                      return realtimeDatabase
                        .ref(
                          `/intents/mark_as_pickup/${timestamp}/${freightageRef}/${userRef}/response`
                        )
                        .ref.set({ code: 201 });
                    });
                })
                .catch(onrejected => {
                  console.log("Reject", onrejected);
                  return realtimeDatabase
                    .ref(
                      `/intents/mark_as_pickup/${timestamp}/${freightageRef}/${userRef}/response`
                    )
                    .ref.set({ code: 500 });
                });
            })
            .catch(onrejected => {
              console.log("Reject", onrejected);
              return realtimeDatabase
                .ref(
                  `/intents/mark_as_pickup/${timestamp}/${freightageRef}/${userRef}/response`
                )
                .ref.set({ code: 500 });
            });
        })
        .catch(onrejected => {
          console.log("Reject", onrejected);
          return realtimeDatabase
            .ref(
              `/intents/mark_as_pickup/${timestamp}/${freightageRef}/${userRef}/response`
            )
            .ref.set({ code: 500 });
        });
      console.log("ici");
      return true;
    });

  /**
   * 1- get freightage
   * 2- check if user is owner of freightage
   * 3- get drivers and check if user is driver
   * 4- check if user allready mark as pickup
   * 5- delete carrying items if validate false
   * 6- mark as pickup if validate true
   * 7- save freightage
   * 8- send fcm to trucker
   */
  static listenValidatePickup = functions.database
    .ref("/intents/validate_pickup/{timestamp}/{freightageRef}/{userRef}")
    .onCreate(async (snapshot, context) => {
      const firestore = admin.firestore();
      const realtimeDatabase = admin.database();

      const freightageRef = context.params.freightageRef;
      const userRef = context.params.userRef;
      const timestamp = context.params.timestamp;

      const postData = snapshot.val();
      /** Step 1 */
      firestore
        .doc(Users.getRef(userRef))
        .get()
        .then(async userDataSnapshot => {
          const userData = userDataSnapshot.data();
          console.log(userData, userRef, postData);
          if (
            userData["transaction_pin_code"] + "" !==
            "" + postData["password"]
          ) {
            return realtimeDatabase
              .ref(
                `/intents/validate_pickup/${timestamp}/${freightageRef}/${userRef}/response`
              )
              .ref.set({ code: 403 });
          }
          await firestore
            .runTransaction(t => {
              return t
                .get(firestore.doc(Freightages.getRef(freightageRef)))
                .then(freightageDataSnapshot => {
                  const freightageData = freightageDataSnapshot.data();
                  /** Step 2 */
                  if (
                    Users.getRef(userRef).indexOf(freightageData.userRef) === -1
                  ) {
                    realtimeDatabase
                      .ref(
                        `/intents/validate_pickup/${timestamp}/${freightageRef}/${userRef}/response`
                      )
                      .ref.set({ code: 401 });
                    return Promise.reject("Un-authorized.");
                  }
                  /** Step 3 */
                  const driverFound = freightageData.drivers.find(
                    driver =>
                      postData.driverRef.indexOf(driver.driverRef) !== -1
                  );
                  if (!driverFound) {
                    realtimeDatabase
                      .ref(
                        `/intents/validate_pickup/${timestamp}/${freightageRef}/${userRef}/response`
                      )
                      .ref.set({ code: 403 });
                    return Promise.reject("Invalid driver");
                  }
                  /** Step 4 */
                  if (driverFound.pickup) {
                    realtimeDatabase
                      .ref(
                        `/intents/validate_pickup/${timestamp}/${freightageRef}/${userRef}/response`
                      )
                      .ref.set({ code: 409 });

                    return Promise.reject("Already validate");
                  }
                  /** Step 5 and 6 */
                  const new_items = freightageData.items;
                  driverFound.items.forEach(item => {
                    const remote_item = new_items[item.index];
                    if (!postData.validate)
                      remote_item.carrying_quantity -= item.carrying_quantity;
                  });
                  let pickup = true;
                  let onTransit = freightageData.onTransit;
                  if (postData.validate) {
                    onTransit = true;
                    pickup = false;
                    freightageData.drivers.forEach(elt => {
                      if (
                        postData.driverRef.indexOf(elt.driverRef) === -1 &&
                        !elt.pickup
                      )
                        pickup = true;
                    });
                  }

                  /** Step 7 */
                  t.update(firestore.doc(Freightages.getRef(freightageRef)), {
                    onTransit,
                    pickup,
                    items: new_items,
                    drivers: freightageData.drivers.map(driver => {
                      if (postData.driverRef.indexOf(driver.driverRef) !== -1) {
                        if (!postData.validate) driver.items = [];
                        else driver.onTransit = true;
                        driver.pickup = postData.validate;
                      }
                      return driver;
                    })
                  });
                  return Promise.resolve("Success");
                });
              // .catch(onrejected => {
              //   console.log("Reject", onrejected);
              //    return realtimeDatabase.ref(`/intents/validate_pickup/${timestamp}/${freightageRef}/${userRef}/response`).ref
              //        .set({ code: 500 })
              // });
            })
            .then(() => {
              /** Step 8 */
              //send fcm
              return realtimeDatabase
                .ref(
                  `/intents/validate_pickup/${timestamp}/${freightageRef}/${userRef}/response`
                )
                .ref.set({ code: 201 });
            })
            .catch(onrejected => {
              console.log("Reject", onrejected);
              //   return realtimeDatabase
              //     .ref(
              //       `/intents/validate_pickup/${timestamp}/${freightageRef}/${userRef}/response`
              //     )
              //     .ref.set({ code: 500 });
            });
        })
        .catch(onrejected => {
          console.log("Reject", onrejected);
          return realtimeDatabase
            .ref(
              `/intents/validate_pickup/${timestamp}/${freightageRef}/${userRef}/response`
            )
            .ref.set({ code: 500 });
        });
      console.log("ici");
      return true;
    });
}
