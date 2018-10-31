import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import { Freightages } from '../models';
import { isArray } from 'util';

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
                    if(freightageData.bargainers && isArray(freightageData.bargainers)){
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


}