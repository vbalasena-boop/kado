"use client";

import dynamic from "next/dynamic";

const HomeGames = dynamic(() => import("./HomeGames"));

export default HomeGames;
