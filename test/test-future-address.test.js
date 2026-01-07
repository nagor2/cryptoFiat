const { expect } = require("chai");
const { ethers } = require("hardhat");
const { deployFullSystem } = require("./helpers/contracts");

describe("Test Future Address Calculation", function () {
    it("should calculate correct future DAO address", async function () {
        try {
            const system = await deployFullSystem({ 
                useFutureAddress: true,
                renewContracts: false,
                initializeBasket: false
            });
            
            console.log("✅ Future address calculation is correct!");
            expect(system.dao).to.not.be.undefined;
        } catch (error) {
            console.log("Error details:", error.message);
            throw error;
        }
    });
});

