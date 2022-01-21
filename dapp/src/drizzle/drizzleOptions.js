import CDP from "../contracts/CDP.json";
const options = {
    contracts: [CDP],
    events: {
        CDP: ["DataChanged"],
    },
};
export default options;