require("dotenv").config();

module.exports = {
	packagerConfig: {
		ignore: "/node_modules/electron-packager|/server/database.sqlite3",
		icon: "build/synthona.icns",
		overwrite: true,
		osxSign: {
			optionsForFile: (filePath) => {
				// Here, we keep it simple and return a single entitlements.plist file.
				// You can use this callback to map different sets of entitlements
				// to specific files in your packaged app.
				return {
					entitlements: "entitlements.plist",
				};
			},
		},
		osxNotarize: {
			tool: "notarytool",
			appleId: process.env.APPLE_ID,
			appleIdPassword: process.env.APPLE_ID_PASSWORD,
			teamId: process.env.APPLE_TEAM_ID,
		},
	},
	rebuildConfig: {},
	makers: [
		{
			name: "@electron-forge/maker-squirrel",
			config: {
				icon: "build/synthona.icns",
				loadingGif: "build/initializing.gif",
			},
		},
		{
			name: "@electron-forge/maker-dmg",
			platforms: ["darwin"],
			config: {
				icon: "build/synthona.icns",
				format: "ULFO",
			},
		},
		{
			name: "@electron-forge/maker-deb",
			config: {
				icon: "build/synthona.icns",
				maintainer: "ian mccauley",
				homepage: "http://www.synthona.net",
			},
		},
		{
			name: "@electron-forge/maker-rpm",
			config: {
				icon: "build/synthona.icns",
			},
		},
	],
};
