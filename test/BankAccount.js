const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { expect } = require("chai");

const { ethers } = require("hardhat");

describe("BankAccount", function () {
  async function deployBankAccount() {
    const [addr0, addr1, addr2, addr3, addr4] = await ethers.getSigners();
    const BankAccount = await ethers.getContractFactory("BankAccount");
    const bankAccount = await BankAccount.deploy();

    return { bankAccount, addr0, addr1, addr2, addr3, addr4 };
  }

  async function setupAccount({
    owners = 1,
    deposit = 0,
    withdrawAmounts = [],
  }) {
    const [addr0, addr1, addr2, addr3, addr4] = await ethers.getSigners();
    const BankAccount = await ethers.getContractFactory("BankAccount");
    const bankAccount = await BankAccount.deploy();

    const addresses =
      {
        2: [addr1],
        3: [addr1, addr2],
        4: [addr1, addr2, addr3],
      }[owners] || [];

    await bankAccount.connect(addr0).createAccount(addresses);

    if (deposit > 0) {
      await bankAccount
        .connect(addr0)
        .deposit(0, { value: deposit.toString() });
    }

    for (const amount of withdrawAmounts) {
      await bankAccount.connect(addr0).requestWithdrawl(0, amount);
    }

    return { bankAccount, addr0, addr1, addr2, addr3, addr4 };
  }

  describe("Deploy", () => {
    it("Should deploy successfuly", async () => {
      await loadFixture(deployBankAccount);
    });
  });

  describe("Creating account", () => {
    it("Should allow creating a single user account", async () => {
      const { bankAccount, addr0 } = await loadFixture(deployBankAccount);
      await expect(bankAccount.connect(addr0).createAccount([])).to.emit(
        bankAccount,
        "AccountCreated"
      );
      const accounts = await bankAccount.connect(addr0).getAccounts();
      expect(accounts.length).to.equal(1);
    });

    it("Should allow creating a double user account", async () => {
      const { bankAccount, addr0, addr1 } = await loadFixture(
        deployBankAccount
      );
      await bankAccount.connect(addr0).createAccount([addr1]);

      const accounts1 = await bankAccount.connect(addr0).getAccounts();
      expect(accounts1.length).to.equal(1);

      const accounts2 = await bankAccount.connect(addr1).getAccounts();
      expect(accounts2.length).to.equal(1);
    });

    it("Should allow creating a tripple user account", async () => {
      const { bankAccount, addr0, addr1, addr2 } = await loadFixture(
        deployBankAccount
      );
      await bankAccount.connect(addr0).createAccount([addr1, addr2]);

      const accounts1 = await bankAccount.connect(addr0).getAccounts();
      expect(accounts1.length).to.equal(1);

      const accounts2 = await bankAccount.connect(addr1).getAccounts();
      expect(accounts2.length).to.equal(1);

      const accounts3 = await bankAccount.connect(addr2).getAccounts();
      expect(accounts3.length).to.equal(1);
    });

    it("Should allow creating a quad user account", async () => {
      const { bankAccount, addr0, addr1, addr2, addr3 } = await loadFixture(
        deployBankAccount
      );
      await bankAccount.connect(addr0).createAccount([addr1, addr2, addr3]);

      const accounts1 = await bankAccount.connect(addr0).getAccounts();
      expect(accounts1.length).to.equal(1);

      const accounts2 = await bankAccount.connect(addr1).getAccounts();
      expect(accounts2.length).to.equal(1);

      const accounts3 = await bankAccount.connect(addr2).getAccounts();
      expect(accounts3.length).to.equal(1);

      const accounts4 = await bankAccount.connect(addr3).getAccounts();
      expect(accounts4.length).to.equal(1);
    });

    it("Should not allow creating account with duplicated user", async () => {
      const { bankAccount, addr0, addr1, addr2 } = await loadFixture(
        deployBankAccount
      );
      await expect(bankAccount.connect(addr0).createAccount([addr0])).to.be
        .reverted;

      await expect(
        bankAccount.connect(addr0).createAccount([addr1, addr2, addr1])
      ).to.be.reverted;
    });

    it("Should not allow creating an account with more than 4 owners", async () => {
      const { bankAccount, addr0, addr1, addr2, addr3, addr4 } =
        await loadFixture(deployBankAccount);
      await expect(
        bankAccount.connect(addr0).createAccount([addr1, addr2, addr3, addr4])
      ).to.be.reverted;
    });

    it("Should not allow creating an account if creator already reached max limit (3)", async () => {
      const { bankAccount, addr0 } = await loadFixture(deployBankAccount);

      for (let i = 0; i < 3; i++) {
        await bankAccount.connect(addr0).createAccount([]);
      }

      await expect(bankAccount.connect(addr0).createAccount([])).to.be.reverted;
    });

    it("Should not allow creating an account if one of the owners already reached max limit (3)", async () => {
      const { bankAccount, addr1, addr2 } = await loadFixture(
        deployBankAccount
      );

      for (let i = 0; i < 3; i++) {
        await bankAccount.connect(addr1).createAccount([]);
      }

      await expect(bankAccount.connect(addr2).createAccount([addr1])).to.be
        .reverted;
    });
  });

  describe("Depositing", () => {
    it("Should allow deposit from account owner", async () => {
      const { bankAccount, addr0 } = await setupAccount(1);

      await expect(
        bankAccount.connect(addr0).deposit(0, { value: "100" })
      ).to.changeEtherBalances([bankAccount, addr0], ["100", "-100"]);
    });

    it("Should not allow deposit from non-account owner", async () => {
      const { bankAccount, addr1 } = await setupAccount(1);

      await expect(bankAccount.connect(addr1).deposit(0, { value: "100" })).to
        .be.reverted;
    });
  });

  describe("Withdraw", () => {
    describe("Request a withdraw", () => {
      it("Should allow owner to request a withdraw", async () => {
        const { bankAccount, addr0 } = await setupAccount({ deposit: 100 });

        await bankAccount.connect(addr0).requestWithdrawl(0, 100);
      });

      it("Should not allow withdraw with invalid amount", async () => {
        const { bankAccount, addr0 } = await setupAccount({ deposit: 100 });

        await expect(bankAccount.connect(addr0).requestWithdrawl(0, 101)).to.be
          .reverted;
      });

      it("Should not allow non-owner withdraw", async () => {
        const { bankAccount, addr1 } = await setupAccount({ deposit: 100 });

        await expect(bankAccount.connect(addr1).requestWithdrawl(0, 101)).to.be
          .reverted;
      });

      it("Should allow multiple withdraws whithin the balance range", async () => {
        const { bankAccount, addr0, addr1 } = await setupAccount({
          owners: 2,
          deposit: 100,
        });

        await bankAccount.connect(addr0).requestWithdrawl(0, 90);
        await bankAccount.connect(addr1).requestWithdrawl(0, 10);
      });
    });

    describe("Approve a withdraw", () => {
      it("Should allow the owner to approve the withdraw", async () => {
        const { bankAccount, addr1 } = await setupAccount({
          deposit: 100,
          owners: 2,
          withdrawAmounts: [10, 20],
        });

        await bankAccount.connect(addr1).approveWithdrawl(0, 0);
        await bankAccount.connect(addr1).approveWithdrawl(0, 1);

        expect(await bankAccount.getApprovals(0, 0)).to.equal(1);
        expect(await bankAccount.getApprovals(0, 1)).to.equal(1);
      });

      it("Should not allow the non-owner to approve the withdraw", async () => {
        const { bankAccount, addr2 } = await setupAccount({
          deposit: 100,
          owners: 2,
          withdrawAmounts: [20],
        });

        await expect(bankAccount.connect(addr2).approveWithdrawl(0, 0)).to.be
          .reverted;
      });

      it("Should not allow the owner to approve the withdraw multiple times", async () => {
        const { bankAccount, addr1 } = await setupAccount({
          deposit: 100,
          owners: 2,
          withdrawAmounts: [50],
        });
        await bankAccount.connect(addr1).approveWithdrawl(0, 0);
        await expect(bankAccount.connect(addr1).approveWithdrawl(0, 0)).to.be
          .reverted;
      });

      it("Should not allow the creator to approve the withdraw", async () => {
        const { bankAccount, addr0 } = await setupAccount({
          deposit: 100,
          owners: 2,
          withdrawAmounts: [20],
        });

        await expect(bankAccount.connect(addr0).approveWithdrawl(0, 0)).to.be
          .reverted;
      });
    });

    describe("Make withdraw", () => {
      it("Should allow creator of request to withdraw approved request", async () => {
        const { bankAccount, addr0, addr1 } = await setupAccount({
          deposit: 100,
          owners: 2,
          withdrawAmounts: [100],
        });

        await bankAccount.connect(addr1).approveWithdrawl(0, 0);
        await expect(
          bankAccount.connect(addr0).withdraw(0, 0)
        ).to.changeEtherBalances([bankAccount, addr0], ["-100", "100"]);
      });

      it("Should not allow creator of request to withdraw approved request more than once", async () => {
        const { bankAccount, addr0, addr1 } = await setupAccount({
          deposit: 200,
          owners: 2,
          withdrawAmounts: [100],
        });

        await bankAccount.connect(addr1).approveWithdrawl(0, 0);
        await expect(
          bankAccount.connect(addr0).withdraw(0, 0)
        ).to.changeEtherBalances([bankAccount, addr0], ["-100", "100"]);

        await expect(bankAccount.connect(addr0).withdraw(0, 0)).to.be.reverted;
      });

      it("Should not allow non-creator of request to withdraw approved request", async () => {
        const { bankAccount, addr1 } = await setupAccount({
          deposit: 200,
          owners: 2,
          withdrawAmounts: [100],
        });

        await bankAccount.connect(addr1).approveWithdrawl(0, 0);
        await expect(bankAccount.connect(addr1).withdraw(0, 0)).to.be.reverted;
      });
    });
  });
});
