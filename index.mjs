// node
import fs from "fs";

// npm
import axios from "axios";

// data
import { artists } from "./artists.mjs";
const wpUrl = "https://fr.wikipedia.org/w/api.php";
const wdUrl = "https://www.wikidata.org/w/api.php";

// functions
const log = a => console.log(a) || a;
const logData = a => console.log(a.data) || a;

const formatWikiText = text =>
  text
    .replace("== Biographie ==", "")
    .replace(/\n/g, "<br />")
    .replace(/\[\[/g, "")
    .replace(/\]\]/g, "");

const createUrl = (baseUrl, params, last) => {
  let paramsStr = "?";
  for (let key in params) {
    paramsStr += key + "=" + params[key] + "&";
  }
  return baseUrl + paramsStr + last;
};

const mapOnSection = (n, key, prev) =>
  Promise.all(
    prev.map(artist => {
      return axios.get(
        createUrl(
          wpUrl,
          {
            action: "parse",
            format: "json",
            prop: "wikitext",
            section: n
          },
          "page=" + artist.name
        )
      );
    })
  ).then(all => {
    return all.map((res, i) => {
      prev[i].data[key] = formatWikiText(res.data.parse.wikitext["*"]);
      return prev[i];
    });
  });

const mapOnProperty = (prop, key, prev) =>
  Promise.all(
    prev.map(artist => {
      const id = artist.data.wikibase_item;
      return axios.get(
        createUrl(
          wdUrl,
          {
            action: "wbgetentities",
            props: "labels|descriptions|claims|sitelinks/urls",
            languages: "fr",
            formatversion: 2,
            format: "json"
          },
          "ids=" + id
        )
      );
    })
  ).then(all => {
    return all.map((res, i) => {
      const id = prev[i].data.wikibase_item;
      prev[i].data[key] =
        res.data.entities[id].claims[prop][0].mainsnak.datavalue.value.time;
      return prev[i];
    });
  });

const urls = Promise.all(
  artists.map(artist => {
    return axios.get(
      createUrl(
        wpUrl,
        {
          action: "parse",
          format: "json"
        },
        "page=" + artist.name
      )
    );
  })
);

urls
  .then(all =>
    all
      .filter(res => res.data && res.data.parse)
      .map(({ data: { parse } }) => {
        return {
          name: parse.title,
          data: {
            wikibase_item: parse.properties.find(
              a => a.name === "wikibase_item"
            )["*"]
          }
        };
      })
  )
  .then(result => mapOnSection(0, "intro", result))
  .then(result => mapOnSection(1, "bio", result))
  .then(result => mapOnProperty("P569", "naissance", result))
  .then(result => fs.writeFileSync("./artists.json", JSON.stringify(result)));

/*   axios
    .get("https://www.wikidata.org/w/api.php" + "?action=wbgetentities&ids=Q492909&props=labels|descriptions|claims|sitelinks/urls&languages=fr&formatversion=2&format=json")
    .then((res) => res.data.entities.Q492909.claims.P569[0].mainsnak.datavalue.value.time)
    .then(log) */
