export interface Author {
	name: string;
	description?: string;
	sameAs?: string[];
	image?: string;
	url?: string;
}

export const AUTHORS: Map<string, Author> = new Map([
	[
		"220683580467052544",
		{
			name: "Abigail Palmero (Abbytec)",
			description:
				"Full Stack Developer | Java Spring • React & Vue • NodeJS • DBs SQL/NoSQL | +10 techs | Autodidacta & proactiva | Apasionada por crear soluciones escalables y ayudar a crecer equipos",
			sameAs: ["https://github.com/abbytec", "https://www.linkedin.com/in/abby-pal/"],
			image: "https://abbytec-portfolio.vercel.app/pfp.jpg",
			url: "https://abbytec.dev.ar",
		},
	],
	[
		"399254838438789130",
		{
			name: "SoySalwa",
			description: "C++ Developer, FullStack Developer.",
			sameAs: ["https://github.com/soysalwa"],
			image: "https://soysalwa.pages.dev/FurinaL.png",
			url: "https://soysalwa.pages.dev/",
		},
	],
]);
