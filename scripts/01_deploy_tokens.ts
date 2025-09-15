import { ethers } from "hardhat";
import { saveDeployments, loadDeployments } from "../helpers/addresses";

const ONE_MILLION = 1_000_000n;

export async function deployTokens() {
  const [deployer] = await ethers.getSigners();

  const USDT6 = await ethers.getContractFactory("USDT6");
  const usdt = await USDT6.deploy(ONE_MILLION * 10n ** 6n * 1_000n, deployer.address); // 1e9 USDT supply
  await usdt.waitForDeployment();

  const ERC20Decimals = await ethers.getContractFactory("ERC20Decimals");

  const tka = await ERC20Decimals.deploy("Token A", "TKA", 18, ONE_MILLION * 10n ** 18n * 1_000n, deployer.address);
  await tka.waitForDeployment();
  const tkb = await ERC20Decimals.deploy("Token B", "TKB", 18, ONE_MILLION * 10n ** 18n * 1_000n, deployer.address);
  await tkb.waitForDeployment();
  const tkc = await ERC20Decimals.deploy("Token C", "TKC", 18, ONE_MILLION * 10n ** 18n * 1_000n, deployer.address);
  await tkc.waitForDeployment();

  const d = await loadDeployments();
  d.tokens = {
    USDT: await usdt.getAddress(),
    TKA: await tka.getAddress(),
    TKB: await tkb.getAddress(),
    TKC: await tkc.getAddress(),
  };
  await saveDeployments(d);

  console.log("Tokens deployed:");
  console.log("  USDT:", d.tokens.USDT);
  console.log("  TKA:", d.tokens.TKA);
  console.log("  TKB:", d.tokens.TKB);
  console.log("  TKC:", d.tokens.TKC);
}

if (require.main === module) {
  deployTokens().catch((e) => {
    console.error(e);
    process.exitCode = 1;
  });
}

