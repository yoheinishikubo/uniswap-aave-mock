import { ethers } from "hardhat";
import { loadDeployments, saveDeployments } from "../helpers/addresses";
import { encodePriceSqrt } from "../helpers/price";
import { approveMax } from "../helpers/approve";

// Uniswap artifacts
// eslint-disable-next-line @typescript-eslint/no-var-requires
const FactoryArtifact = require("@uniswap/v3-core/artifacts/contracts/UniswapV3Factory.sol/UniswapV3Factory.json");
// eslint-disable-next-line @typescript-eslint/no-var-requires
const NPMArtifact = require("@uniswap/v3-periphery/artifacts/contracts/NonfungiblePositionManager.sol/NonfungiblePositionManager.json");
// eslint-disable-next-line @typescript-eslint/no-var-requires
const PoolArtifact = require("@uniswap/v3-core/artifacts/contracts/UniswapV3Pool.sol/UniswapV3Pool.json");

const FEE_3000 = 3000;
const MIN_TICK = -887220;
const MAX_TICK = 887220;

export async function createPoolsAndLiquidity() {
  const [deployer] = await ethers.getSigners();
  const d = await loadDeployments();

  if (!d.factory || !d.positionManager || !d.tokens)
    throw new Error("Missing deployments; run 00 and 01 first");

  const factory = new ethers.Contract(d.factory, FactoryArtifact.abi, deployer);
  const npm = new ethers.Contract(d.positionManager, NPMArtifact.abi, deployer);

  const usdt = await ethers.getContractAt(
    "ERC20Decimals",
    d.tokens.USDT,
    deployer
  );
  const tka = await ethers.getContractAt(
    "ERC20Decimals",
    d.tokens.TKA,
    deployer
  );
  const tkb = await ethers.getContractAt(
    "ERC20Decimals",
    d.tokens.TKB,
    deployer
  );
  const tkc = await ethers.getContractAt(
    "ERC20Decimals",
    d.tokens.TKC,
    deployer
  );

  const pairs = [
    {
      key: "USDT_TKA_3000",
      a: await usdt.getAddress(),
      b: await tka.getAddress(),
      fee: 3000,
      decA: 6,
      decB: 18,
    },
    {
      key: "USDT_TKB_3000",
      a: await usdt.getAddress(),
      b: await tkb.getAddress(),
      fee: 3000,
      decA: 6,
      decB: 18,
    },
    {
      key: "USDT_TKC_3000",
      a: await usdt.getAddress(),
      b: await tkc.getAddress(),
      fee: 3000,
      decA: 6,
      decB: 18,
    },
  ] as const;

  d.pools = d.pools || {};

  for (const { key, a, b, fee, decA, decB } of pairs) {
    const token0 = a.toLowerCase() < b.toLowerCase() ? a : b;
    const token1 = a.toLowerCase() < b.toLowerCase() ? b : a;

    const dec0 = token0.toLowerCase() === a.toLowerCase() ? decA : decB;
    const dec1 = token1.toLowerCase() === a.toLowerCase() ? decA : decB;

    const sqrtPriceX96 = encodePriceSqrt("1", dec1, "1", dec0);

    const tx = await npm.createAndInitializePoolIfNecessary(
      token0,
      token1,
      fee,
      sqrtPriceX96
    );
    const receipt = await tx.wait();

    const poolAddress = await factory.getPool(token0, token1, fee);
    console.log(
      `Pool ${token0}/${token1}@${fee}:`,
      poolAddress,
      "sqrtPriceX96:",
      sqrtPriceX96.toString()
    );

    // Approvals for adding liquidity
    const token0Ctr = await ethers.getContractAt(
      "ERC20Decimals",
      token0,
      deployer
    );
    const token1Ctr = await ethers.getContractAt(
      "ERC20Decimals",
      token1,
      deployer
    );
    await approveMax(token0Ctr, deployer, await npm.getAddress());
    await approveMax(token1Ctr, deployer, await npm.getAddress());

    const amount0Desired = 1_000_000n * 10n ** BigInt(dec0);
    const amount1Desired = 1_000_000n * 10n ** BigInt(dec1);

    const params = {
      token0,
      token1,
      fee,
      tickLower: MIN_TICK,
      tickUpper: MAX_TICK,
      amount0Desired,
      amount1Desired,
      amount0Min: 0,
      amount1Min: 0,
      recipient: deployer.address,
      deadline: Math.floor(Date.now() / 1000) + 60 * 10,
    };

    // Predict tokenId using staticCall (ethers v6) then mint
    const sim = await (npm as any).getFunction("mint").staticCall(params);
    const mintTx = await npm.mint(params);
    await mintTx.wait();

    // Fetch liquidity from pool to assert > 0
    const pool = new ethers.Contract(poolAddress, PoolArtifact.abi, deployer);
    const liquidity: bigint = await pool.liquidity();

    d.pools[key] = {
      address: poolAddress,
      positionId: sim.tokenId.toString(),
      sqrtPriceX96: sqrtPriceX96.toString(),
    };

    console.log("  Minted liquidity, pool liquidity:", liquidity.toString());
  }

  await saveDeployments(d);
}

if (require.main === module) {
  createPoolsAndLiquidity().catch((e) => {
    console.error(e);
    process.exitCode = 1;
  });
}
