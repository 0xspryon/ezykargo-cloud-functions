export class PhonenumberUtils {

    /**
     * Determines the momo provider from the phonenumber
     * @input number in the format +237... please do ensure your 
     * phonenumber starts with +237.
     */
    static getMomoProviderFromNumber = number => {
        let index = -1;
        const MTN = 7;
        const ORANGE = 9;
        const NEXTTEL = 6;
        const MTN_ORANGE = 5;
        const ORANGE_3 = 655;
        const afterPlus237PrefixIndex = 3 + 1
        const two_character_prefix = `${number}`.substr( afterPlus237PrefixIndex , 2)
        console.log({two_character_prefix})
        if(two_character_prefix.indexOf(`${MTN}`) !== -1) return 'momo';
        if(two_character_prefix.indexOf(`${ORANGE}`) !== -1) return 'om';
        if(two_character_prefix.indexOf(`${MTN_ORANGE}`) !== -1) {
            const three_character_prefix = `${number}`.substr( afterPlus237PrefixIndex , 3)
            console.log({three_character_prefix, ORANGE_3, afterPlus237PrefixIndex, number})
            if(+three_character_prefix < +ORANGE_3 ) return 'momo'
            else return 'om'
        }
        if(two_character_prefix.indexOf(`${NEXTTEL}`) !== -1) return 'nexttel';
        return null;
    }


}