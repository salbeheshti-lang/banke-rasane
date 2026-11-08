# Decor-program image research status

Scope: the 1,161 records selected by the app's `hasDecor` filter in `src/app/page.tsx`.
This is a first-pass research log, not a declaration that a program has no image anywhere.
Programs without a verified image remain eligible for later re-checks. Do not substitute a logo,
guest portrait, generic studio, unrelated event venue, or a photograph whose reuse license is
unclear.

## Actual image displayability audit

The app deliberately ignores legacy local paths such as `/program-images/p4_img1.png` because
those are old, incorrect movie posters rather than program-decor photographs. The thumbnail
logic only renders an external HTTP(S) URL from `show.images[]`, or a separately stored DB BLOB.

- Decor-filter records: **1,161**.
- Records with any `images[]` entry: **535** (this includes ignored legacy local paths).
- Records with a displayable external seed-image URL: **21** records, representing **20 unique sources** (record #816 reuses #39).
- Records with legacy local paths only, which the UI intentionally skips: **514**.
- Records with no `images[]` entry: **626**.
- Records without a displayable seed image in a clean install: **1,140 / 1,161 (98.2%)**.

The 21 external URLs are all listed in `public/IMAGE-CREDITS.md`, which is bundled with the app.
Do not count legacy local paths as image coverage.

## Verified images already added

- #31 — De Wereld Draait Door — verified Commons studio photograph; attribution is in
  [PROGRAM-IMAGE-ATTRIBUTION.md](./PROGRAM-IMAGE-ATTRIBUTION.md).
- #48 — Evening Urgant — verified Commons recording/studio photograph; attribution is in
  [PROGRAM-IMAGE-ATTRIBUTION.md](./PROGRAM-IMAGE-ATTRIBUTION.md).

## First-pass checks: records #1–#20

Checked 8 November 2026. Searches prioritized exact program title + studio/set and Wikimedia
Commons. “No verified image in first pass” means continue to the next program now and revisit
later; it does not mean the program definitively has no image.

| # | Program | First-pass result | Notes |
|---:|---|---|---|
| 1 | Ayuready? | No verified image in first pass | No exact licensed studio photograph surfaced. |
| 2 | Baisden After Dark | No verified image in first pass | No exact licensed studio photograph surfaced. |
| 3 | BattleCast Primetime – Aftermath | No verified image in first pass | Search results did not establish a licensed photograph of this show's actual set. |
| 4 | BBC Breakfast | No verified image in first pass | A Commons title graphic is not a set photograph; Commons photographs found from interviews at 10 Downing Street are not the studio. |
| 5 | Ohlson & Can، Beckman | No verified image in first pass | No exact licensed studio photograph surfaced. |
| 6 | Because I Said So | No verified image in first pass | Search results were unrelated audio or other uses of the phrase. |
| 7 | Between Two Ferns with Zach Galifianakis | No verified image in first pass | The Commons Obama interview image is in the White House Diplomatic Reception Room, not the show's signature set; another image has restrictive reuse terms. |
| 8 | Classic Game Room | No verified image in first pass | No exact licensed studio photograph surfaced. |
| 9 | Clement direkte med clement Kjersgaard | No verified image in first pass | No exact licensed studio photograph surfaced. |
| 10 | CMI The Chris Myers Interview | No verified image in first pass | No exact licensed studio photograph surfaced. |
| 11 | Colpo Di Genio | No verified image in first pass | Production references found, but no verified licensed image of the actual set. |
| 12 | !Comedy Bang! Bang | No verified image in first pass | No exact licensed studio photograph surfaced. |
| 13 | CosmoGirl! Spy | No verified image in first pass | Program references found, but no verified licensed image of the actual set. |
| 14 | Comedy Club | No verified image in first pass | Results were ambiguous or referred to unrelated comedy venues/shows. |
| 15 | Behind the Headlines with Wen Tao | No verified image in first pass | No exact licensed studio photograph surfaced. |
| 16 | Black Men Revealed | No verified image in first pass | Editorial/press material describes the show, but no reusable photograph of the actual set was verified. |
| 17 | Bokura no jidai | No verified image in first pass | No exact licensed studio photograph surfaced. |
| 18 | Bolshaya stirka | No verified image in first pass | Program references found, but no verified licensed image of the actual set. |
| 19 | Bons Baisers Be France | No verified image in first pass | Production references found, but no verified licensed image of the actual set. |
| 20 | Boston Tea Party | No verified image in first pass | Program references found, but no verified licensed image of the actual set. |

## Acceptance criteria

An image is added only after confirming all of the following:
1. It depicts the actual program's set/studio, not just a host, guest, logo, poster, or unrelated venue.
2. The file's source page identifies the creator/source and a license that permits repository redistribution.
3. A stable direct media URL is available and the image can be loaded.
4. The corresponding program record is matched by exact title/identity.
5. Creator, source, date when available, license, and any changes are recorded in the attribution manifest.

No changes to the app UI, genre logic, or program descriptions are part of this image-research task.

## First-pass checks: records #21–#41

Checked 8 November 2026. Continue past every unresolved record; “no verified image” is provisional.

| # | Program | First-pass result | Notes |
|---:|---|---|---|
| 21 | Brand X with Russell Brand | No verified image in first pass | No reusable exact-set photograph verified. |
| 22 | Brekky Central Sunrise | No verified image in first pass | No exact licensed studio photograph surfaced. |
| 23 | Brian Mørk Show | No verified image in first pass | Program references found, but no licensed photograph of the actual set verified. |
| 24 | Brian Lehrer Live | No verified image in first pass | No exact licensed studio photograph surfaced. |
| 25 | Bringing it Home with Laura McIntosh | No verified image in first pass | Official PBS program page found; no redistributable set photograph verified. |
| 26 | BSU Tonight | No verified image in first pass | Ball State confirms studio use, but no reusable photograph of this show's actual set verified. |
| 27 | C à vous | No verified image in first pass | Studio photographs exist in press coverage, but reuse license is not established. |
| 28 | Christine Cushing Live | No verified image in first pass | No exact licensed studio photograph surfaced. |
| 29 | Calando fuerte | No verified image in first pass | No exact licensed studio photograph surfaced. |
| 30 | Im Glashaus - Das philosophische Quartett | No verified image in first pass | IMDb episode stills are not a verified reusable license. |
| 31 | De wereld draait door | Verified image added | See attribution manifest. |
| 32 | Der Sonntags-Stammtisch | No verified image in first pass | No exact licensed studio photograph surfaced. |
| 33 | Cool Japan | No verified image in first pass | A participant blog shows the studio but does not establish a reusable license. |
| 34 | Contrarians | No verified image in first pass | No exact licensed studio photograph surfaced. |
| 35 | Comdy Nights with Kapil | No verified image in first pass | No exact licensed studio photograph surfaced. |
| 36 | Conversation with Michael Eisner | No verified image in first pass | No exact licensed studio photograph surfaced. |
| 37 | Conversation from The Edge | No verified image in first pass | No exact licensed studio photograph surfaced. |
| 38 | Fútbol Picante | No verified image in first pass | ESPN press material confirms the studio but does not establish an image reuse license. |
| 39 | Full Frontal with Samantha Bee | Verified image added | Actual stage-set photo, CC BY-SA 4.0; see attribution manifest. |
| 40 | Fröhlich lesen | No verified image in first pass | No exact licensed studio photograph surfaced. |
| 41 | Friday Night with Jonathan Ross | Verified image added | Actual set photo, CC BY 2.0; see attribution manifest. |


## First-pass checks: records #42–#65

Checked 8 November 2026. Programs without a verified image remain queued for later re-checks.

| # | Program | First-pass result | Notes |
|---:|---|---|---|
| 42 | Friday Night Live | No verified image in first pass | No exact licensed image of the show's set surfaced. |
| 43 | G4tv. com | No verified image in first pass | No exact licensed set photograph verified. |
| 44 | Elvis Mitchell: Under the Influence | No verified image in first pass | No exact licensed set photograph surfaced. |
| 45 | Encore with John Palmer | No verified image in first pass | No exact licensed set photograph surfaced. |
| 46 | Encuentros Zabaltegi | No verified image in first pass | No exact licensed set photograph surfaced. |
| 47 | ESPN FC | No verified image in first pass | NewscastStudio has actual set galleries, but a repository-redistribution license was not established. |
| 48 | Evening Urgant | Verified image added | See attribution manifest. |
| 49 | Face 2 Face | No verified image in first pass | No exact licensed studio photograph surfaced. |
| 50 | Fareed Zakaria GPS | No verified image in first pass | NewscastStudio set photos are editorial/design references, not verified as openly licensed for redistribution. |
| 51 | Fashion Police | No verified image in first pass | No exact licensed studio photograph surfaced. |
| 52 | Fast Talk with Boy Abunda | No verified image in first pass | Set photos exist in press coverage, but redistribution rights are not established. |
| 53 | Dorseen 21: 30 | No verified image in first pass | No exact licensed studio photograph surfaced. |
| 54 | Don’t be the First one | No verified image in first pass | Described as filmed in real homes; no reusable studio-set photograph verified. |
| 55 | dLife | No verified image in first pass | No exact licensed studio photograph surfaced. |
| 56 | Die Tietjen und Dibaba | No verified image in first pass | Press/archive images found, but rights are restricted or unclear. |
| 57 | Die Oliver Pocher Show | No verified image in first pass | Studio press photos are limited to promotional/editorial use; no reusable license verified. |
| 58 | Deux Filles le Matin | No verified image in first pass | No exact licensed studio photograph surfaced. |
| 59 | Det nye Talkshow | No verified image in first pass | No exact licensed studio photograph surfaced. |
| 60 | Designing Your Future | No verified image in first pass | No exact licensed studio photograph surfaced. |
| 61 | Dagens Danmark | No verified image in first pass | No exact licensed studio photograph surfaced. |
| 62 | Dr. Laura | No verified image in first pass | No exact licensed studio photograph surfaced. |
| 63 | Dumont 360 | No verified image in first pass | No exact licensed studio photograph surfaced. |
| 64 | E-Asylum | No verified image in first pass | No exact licensed studio photograph surfaced. |
| 65 | Eigo de Shabera Night | No verified image in first pass | Commons category contains presenter portraits, not the program's set. |


## First-pass checks: records #66–#80

Checked 8 November 2026. These remain provisional no-image results and should be revisited later.

| # | Program | First-pass result | Notes |
|---:|---|---|---|
| 66 | Einfach Alsmann | No verified image in first pass | No exact licensed studio photograph surfaced. |
| 67 | El Reporterito | No verified image in first pass | No exact licensed studio photograph surfaced. |
| 68 | El Show de Don Cheto | No verified image in first pass | No exact licensed studio photograph surfaced. |
| 69 | El Show Latino | No verified image in first pass | No exact licensed studio photograph surfaced. |
| 70 | Elton.tv | No verified image in first pass | No exact licensed studio photograph surfaced. |
| 71 | Dancing on Ice Friday | No verified image in first pass | Search results identify the companion interview show, but no reusable image of its own set verified. |
| 72 | …Five Minutes With | No verified image in first pass | Format uses changing interview locations; no licensed recurring set photograph verified. |
| 73 | Five Cranky Brothers | No verified image in first pass | Program references found, but no reusable exact-set image verified. |
| 74 | Filmnut | No verified image in first pass | IMDb references found, but no reusable set photograph verified. |
| 75 | Fern Britton Meets… | No verified image in first pass | The program is based around interviews at guests' locations; no reusable set photograph verified. |
| 76 | Happy Together | No verified image in first pass | Official KBS program page found, but no redistributable set photo verified. |
| 77 | Berman & Berman | No verified image in first pass | No exact licensed studio photograph surfaced. |
| 78 | Autograf | No verified image in first pass | Search results mainly identify an unrelated film production company. |
| 79 | Anytime with Bob Kushell | No verified image in first pass | Program was reportedly filmed in the host's garage; no licensed image of the actual setup verified. |
| 80 | Ante Usted | No verified image in first pass | No exact licensed studio photograph surfaced. |


## First-pass checks: records #81–#95

Checked 8 November 2026. No item below has passed both exact-set and redistribution-license verification.

| # | Program | First-pass result | Notes |
|---:|---|---|---|
| 81 | Anne Will | No verified image in first pass | Studio press photographs found, but reuse rights are commercial/editorial or unclear. |
| 82 | Angela and Friends | No verified image in first pass | No exact licensed studio photograph surfaced. |
| 83 | After The Catch | No verified image in first pass | No exact licensed bar/set photograph surfaced. |
| 84 | After The School Club | No verified image in first pass | No exact licensed studio photograph surfaced. |
| 85 | Ariel Mothers aka Ariel Maa | No verified image in first pass | Program references found; no reusable photograph of the actual set verified. |
| 86 | Altas Horas | No verified image in first pass | No exact licensed studio photograph surfaced. |
| 87 | Alan Keyes Is Making Sense | No verified image in first pass | No exact licensed studio photograph surfaced. |
| 88 | Aftenshowet | No verified image in first pass | Program is described as broadcasting from Copenhagen City Hall Square; no reusable image of the actual setup verified. |
| 89 | Hot Ones | No verified image in first pass | Studio setup is identifiable, but no openly licensed photo of the actual set verified. |
| 90 | Ame Talk | No verified image in first pass | No exact licensed studio photograph surfaced. |
| 91 | Ace Combat Original Aircraft Official Commentary | No verified image in first pass | Official videos exist, but no independently reusable still/photo license verified. |
| 92 | Acces direct | No verified image in first pass | No exact licensed studio photograph surfaced. |
| 93 | Abnormal Summit | No verified image in first pass | No exact licensed studio photograph surfaced. |
| 94 | Aafareet Hussein ElImam | No verified image in first pass | No exact licensed studio photograph surfaced. |
| 95 | A Little Late with Lilly Singh | No verified image in first pass | NewscastStudio set galleries are useful references, but their photo reuse license is not established. |


## First-pass checks: records #111–#125

Checked 8 November 2026. No new photo passed exact-set and redistribution-license verification in this batch.

| # | Program | First-pass result | Notes |
|---:|---|---|---|
| 111 | Jersild Live | No verified image in first pass | No reusable exact-set photograph verified. |
| 112 | Jewel School - Jewelry Making | No verified image in first pass | Official JTV program page found, but no openly licensed set photo verified. |
| 113 | Johnny Vegas 18 Stone of Idiot | No verified image in first pass | No exact licensed set photograph surfaced. |
| 114 | Joni Table Talk | No verified image in first pass | No exact licensed set photograph surfaced. |
| 115 | Jul med Gud | No verified image in first pass | No reusable image of the actual interview location verified. |
| 116 | Julekrybben: Helligaandskirken | No verified image in first pass | No exact licensed set photograph surfaced. |
| 117 | Kaitai-Shin Show | No verified image in first pass | No exact licensed studio photograph surfaced. |
| 118 | Kangsi Coming | No verified image in first pass | No exact licensed studio photograph surfaced. |
| 119 | Half Circle | No verified image in first pass | No exact licensed studio photograph surfaced. |
| 120 | Half in the Bag | No verified image in first pass | No openly licensed image of the actual set verified. |
| 121 | Happy Hour | No verified image in first pass | No exact licensed studio photograph surfaced. |
| 122 | Die Harald Schmidt Show | No verified image in first pass | Actual set references found, but images surfaced are rights-managed or have no open reuse license. |
| 123 | Hard Knock TV | No verified image in first pass | No exact licensed studio photograph surfaced. |
| 124 | Heads Up with Richard Herring | No verified image in first pass | Creator's archive has episode stills, but no explicit reuse license was established. |
| 125 | Love Naggers | No verified image in first pass | No exact licensed studio photograph surfaced. |


## First-pass checks: records #126–#140

Checked 8 November 2026. No new photo passed exact-set and redistribution-license verification in this batch.

| # | Program | First-pass result | Notes |
|---:|---|---|---|
| 126 | Lorraine | No verified image in first pass | ITV and NewscastStudio show actual set photography, but no open redistribution license was established. |
| 127 | Lopez Tonight | No verified image in first pass | No exact licensed studio photograph surfaced. |
| 128 | Icons | No verified image in first pass | No exact licensed studio photograph surfaced. |
| 129 | In the Qube | No verified image in first pass | No exact licensed studio photograph surfaced. |
| 130 | Internet Superstar | No verified image in first pass | No exact licensed studio photograph surfaced. |
| 131 | Kanon-TV | No verified image in first pass | No exact licensed studio photograph surfaced. |
| 132 | Last Call with Carson Daly | No verified image in first pass | A behind-the-scenes image was found, but not a licensed photograph of the show's decor. |
| 133 | Le club du Net AOL | No verified image in first pass | No exact licensed studio photograph surfaced. |
| 134 | Le Grand Blond Avec Un Show Sournois | No verified image in first pass | Production references found, but no reusable image of the actual set verified. |
| 135 | LiteraTOUR | No verified image in first pass | No exact licensed studio photograph surfaced. |
| 136 | Live from Studio Five | No verified image in first pass | No exact licensed studio photograph surfaced. |
| 137 | Live Talk Show Taxi | No verified image in first pass | Taxi-format images found only as program/promotional material; no reusable set image verified. |
| 138 | Living Smart | No verified image in first pass | No exact licensed studio photograph surfaced. |
| 139 | Love of 7.7 Billion | No verified image in first pass | No exact licensed studio photograph surfaced. |
| 140 | Life Bar | No verified image in first pass | News and platform stills show the bar set, but no openly licensed photo verified. |


## First-pass checks: records #141–#155

Checked 8 November 2026. One additional verified image was found and added.

| # | Program | First-pass result | Notes |
|---:|---|---|---|
| 141 | Lighthouse | No verified image in first pass | Official Netflix material found, but no openly licensed photograph of the actual set verified. |
| 142 | Lilly Allen and Friends | No verified image in first pass | No exact licensed studio photograph surfaced. |
| 143 | Mad Money w/ Jim Cramer | Verified image added | Commons photograph of the actual Mad Money set, CC BY 2.0; see attribution manifest. |
| 144 | Magandang Buhay | No verified image in first pass | No exact licensed studio photograph surfaced. |
| 145 | Magic Eye | No verified image in first pass | No exact licensed studio photograph surfaced. |
| 146 | Man with a Van | No verified image in first pass | No reusable image of the actual van setup verified. |
| 147 | Market Kitchen | No verified image in first pass | No exact licensed kitchen-set photograph surfaced. |
| 148 | Markus Lanz | No verified image in first pass | Studio photos found through press/photo agencies, but reuse rights are restricted. |
| 149 | Keiser Report | No verified image in first pass | No exact licensed studio photograph surfaced. |
| 150 | Die Johannes B. Kerner Show | No verified image in first pass | No exact licensed studio photograph surfaced. |
| 151 | !Lafer! Lichter! Lecker | No verified image in first pass | Production references found, but no openly licensed image of the actual cooking set verified. |
| 152 | La noche con Fuentes y Cía | No verified image in first pass | No exact licensed studio photograph surfaced. |
| 153 | Knowing Bros | No verified image in first pass | No openly licensed photograph of the classroom set verified. |
| 154 | Koffee with Karan | No verified image in first pass | Set images surfaced in entertainment/photo galleries, but reuse licenses are not established. |
| 155 | Nación ESPN | No verified image in first pass | NewscastStudio has a set gallery, but no open redistribution license was established. |


## First-pass checks: records #156–#170

Checked 8 November 2026. No new photo passed exact-set and redistribution-license verification in this batch.

| # | Program | First-pass result | Notes |
|---:|---|---|---|
| 156 | Nedjeljom u dva | No verified image in first pass | Public broadcaster archive references found; no openly licensed image of the actual set verified. |
| 157 | Neeya Naana | No verified image in first pass | No openly licensed photograph of the debate set verified. |
| 158 | Nigella Bites | No verified image in first pass | No openly licensed photograph of the actual kitchen set verified. |
| 159 | Norm Macdonald Has a Show | No verified image in first pass | NewscastStudio has actual set photography, but redistribution license is not established. |
| 160 | Money track | No exact match verified | Search results did not establish the exact program identity or a reusable set photograph. |
| 161 | All-American Makers | No verified image in first pass | No exact licensed workshop-set photograph surfaced. |
| 162 | Martha Stewart’s Cooking School | No verified image in first pass | Host's blog documents the kitchen set, but no open redistribution license was established. |
| 163 | Matutino Express | No verified image in first pass | No exact licensed studio photograph surfaced. |
| 164 | Meet Ricky Gervais | No verified image in first pass | No exact licensed studio photograph surfaced. |
| 165 | Menschen der Woche | No verified image in first pass | Production/location references found, but no reusable photograph of the actual set verified. |
| 166 | Mike and Mike in the Morning | No verified image in first pass | ESPN press material references the set, but reuse license is not established. |
| 167 | Mike’s On | No verified image in first pass | No exact licensed studio photograph surfaced. |
| 168 | The Kumars at No. 42 | No verified image in first pass | Exact set is described in production references, but no openly licensed photograph verified. |
| 169 | Humour Show | No verified image in first pass | Program identity is ambiguous; no exact licensed set image verified. |
| 170 | Now on my way to meet you | No verified image in first pass | Documentary footage shows the actual set, but no separately licensed reusable still verified. |


## First-pass checks: records #171–#185

Checked 8 November 2026. Record #173 is excluded from the 1,161-program decor scope by the app's genre filter.

| # | Program | First-pass result | Notes |
|---:|---|---|---|
| 171 | Our Lives | No verified image in first pass | No exact licensed studio photograph surfaced. |
| 172 | Opposing Viewpoints Live Radio for Television | No verified image in first pass | No exact licensed radio-studio photograph surfaced. |
| 173 | On the Spot | Excluded from decor-program scope | App data classifies this as a competition/reality/documentary outside the talk-show decor set. |
| 174 | On the Couch | No verified image in first pass | Official AFL content and show thumbnails exist, but no openly licensed set photograph verified. |
| 175 | On ne peut pas plaire à tout le monde | No verified image in first pass | No exact licensed studio photograph surfaced. |
| 176 | On Cinema | No verified image in first pass | No openly licensed photograph of the recurring green-screen setup verified. |
| 177 | Prozhektorperiskhilton | No verified image in first pass | No exact licensed studio photograph surfaced. |
| 178 | Programa do Jô | No verified image in first pass | Globo archive has exact set photos, but the images are copyrighted and no redistribution license was established. |
| 179 | Problematic Men | No verified image in first pass | No openly licensed photograph of the actual set verified. |
| 180 | Prime Rewind: Inside the Boys | No verified image in first pass | Set designer portfolio documents the virtual set, but no redistribution license for images was established. |
| 181 | Post Mortem with Mick Garris | No verified image in first pass | No exact licensed studio photograph surfaced. |
| 182 | Rozmowy w toku | No verified image in first pass | No exact licensed studio photograph surfaced. |
| 183 | Rove Live | No verified image in first pass | No exact licensed studio photograph surfaced. |
| 184 | Richard & Judy | No verified image in first pass | No exact licensed studio photograph surfaced. |
| 185 | Radio Star | No verified image in first pass | No openly licensed photograph of the actual set verified. |


## First-pass checks: records #186–#200

Checked 8 November 2026. No new photo passed exact-set and redistribution-license verification in this batch.

| # | Program | First-pass result | Notes |
|---:|---|---|---|
| 186 | Rakt på med K-G Bergström | No verified image in first pass | No exact licensed studio photograph surfaced. |
| 187 | Ranvir Vinay Aur Kaun? | No verified image in first pass | Press photos exist, but no redistribution license for the actual apartment set was established. |
| 188 | Reimers | No verified image in first pass | Program identity and set match need further verification; no reusable image found. |
| 189 | Responsible Health | No verified image in first pass | No exact licensed studio photograph surfaced. |
| 190 | Shouto na Slavi | No verified image in first pass | No exact licensed studio photograph surfaced. |
| 191 | Senkveld med HC og Tommy | No verified image in first pass | Reference images found under restricted reuse terms. |
| 192 | Selena + Chef | No verified image in first pass | HBO/WBD press images are access-controlled; no open redistribution license verified. |
| 193 | Seffaf Oda | No exact match verified | No exact licensed studio photograph surfaced. |
| 194 | Scorch's PFG-TV | No verified image in first pass | Official site found, but no explicit reuse license for set images was established. |
| 195 | Scobel | No verified image in first pass | No exact licensed studio photograph surfaced. |
| 196 | Schmidt & Pocher | No verified image in first pass | Production references identify the studio; no openly licensed set photograph verified. |
| 197 | ?Sarap, 'di ba | No verified image in first pass | No exact licensed studio photograph surfaced. |
| 198 | Satyamev Jayate | No verified image in first pass | Official production information and press photos found, but reuse rights are not established. |
| 199 | Swar Shuaib | No verified image in first pass | No exact licensed studio photograph surfaced. |
| 200 | Sunday AM | No verified image in first pass | BBC studio references found, but no openly licensed image of the show's actual set verified. |


## First-pass checks: records #201–#215

Checked 8 November 2026. No new photo passed exact-set and redistribution-license verification in this batch.

| # | Program | First-pass result | Notes |
|---:|---|---|---|
| 201 | Studio voetbal | No verified image in first pass | No exact licensed studio photograph surfaced. |
| 202 | Stars on Stars | No verified image in first pass | No exact licensed studio photograph surfaced. |
| 203 | Sports Nation | No verified image in first pass | NewscastStudio has the actual set gallery, but no open redistribution license was established. |
| 204 | Sports Jam | No exact match verified | Search results did not establish the exact program identity and reusable image. |
| 205 | Süper Tiger Show | No verified image in first pass | No exact licensed studio photograph surfaced. |
| 206 | Siamo Stati Uniti | No verified image in first pass | No exact licensed basement-set photograph surfaced. |
| 207 | T. A. P. Taller de Actores Profesionales | No verified image in first pass | No exact licensed studio photograph surfaced. |
| 208 | Talking Dead | No verified image in first pass | Actual set photos found in press coverage, but rights are not openly licensed. |
| 209 | Clive James Talking in the Library | No verified image in first pass | Creator archive confirms the living-room setting, but no explicit redistribution license for its images was found. |
| 210 | Tercer grado | No verified image in first pass | No exact licensed studio photograph surfaced. |
| 211 | Tetris | No verified image in first pass | Program references found, but no reusable set photograph verified. |
| 212 | Teveteve | No verified image in first pass | No exact licensed studio photograph surfaced. |
| 213 | The 7PM Project | No verified image in first pass | No exact licensed studio photograph surfaced. |
| 214 | The Alan Titchmarsh Show | No verified image in first pass | Show archive/blog has set photos, but no explicit redistribution license was established. |
| 215 | The Balancing Act | No verified image in first pass | No exact licensed studio photograph surfaced. |


## First-pass checks: records #216–#230

Checked 8 November 2026. No new photo passed exact-set and redistribution-license verification in this batch.

| # | Program | First-pass result | Notes |
|---:|---|---|---|
| 216 | The Big Questions | No verified image in first pass | No exact licensed studio photograph surfaced. |
| 217 | The Bounce | No verified image in first pass | Studio references found, but no openly licensed image of the actual set verified. |
| 218 | The Break with Michelle Wolf | No verified image in first pass | No exact licensed studio photograph surfaced. |
| 219 | The Chew | No verified image in first pass | Actual set photography found, but no open redistribution license was established. |
| 220 | Pust govoryat | No verified image in first pass | No exact licensed studio photograph surfaced. |
| 221 | P3 People, Places, Perspectives | No verified image in first pass | No exact licensed studio photograph surfaced. |
| 222 | Pomeroggo Cinque | No exact match verified | Possible title mismatch; no verified set image found. |
| 223 | Polspoel & Desmet | No verified image in first pass | No exact licensed studio photograph surfaced. |
| 224 | Piper’s Picks TV | No verified image in first pass | No exact licensed studio photograph surfaced. |
| 225 | Pièce d'identité | No verified image in first pass | No exact licensed studio photograph surfaced. |
| 226 | Peut contenir des Rachid | No verified image in first pass | No exact licensed studio photograph surfaced. |
| 227 | Pete's Basement | No verified image in first pass | No exact licensed set photograph surfaced. |
| 228 | Peter Imhof | No verified image in first pass | Press event references found, but no reusable license for studio photos was established. |
| 229 | Pardon the Interruption | No verified image in first pass | Actual set galleries and press photos found, but images are ESPN-owned/copyrighted with no open redistribution license. |
| 230 | Party People | No verified image in first pass | No exact licensed studio photograph surfaced. |


## First-pass checks: records #231–#245

Checked 8 November 2026. No new photo passed exact-set and redistribution-license verification in this batch.

| # | Program | First-pass result | Notes |
|---:|---|---|---|
| 231 | Patriot Act with Hasan Minhaj | No verified image in first pass | Exact set galleries found, but no open redistribution license was established. |
| 232 | Peter Hahne | No verified image in first pass | Exact studio images found through rights-managed photo agencies; no open license verified. |
| 233 | Sleek Geeks | No verified image in first pass | Program references identify studio use, but no openly licensed image of the actual set verified. |
| 234 | Sma STATION | No verified image in first pass | No exact licensed studio photograph surfaced. |
| 235 | Songbook | No verified image in first pass | No exact licensed studio photograph surfaced. |
| 236 | Spuiten en slikken | No verified image in first pass | No exact licensed studio photograph surfaced. |
| 237 | Strong Heart | No verified image in first pass | No openly licensed photograph of the actual set verified. |
| 238 | Ugen med Clement | No verified image in first pass | No exact licensed studio photograph surfaced. |
| 239 | Umagang Kay Ganda | No verified image in first pass | No exact licensed studio photograph surfaced. |
| 240 | Unexpected Q | No verified image in first pass | MBC official pages confirm this was a quiz show; no openly licensed set photograph verified. |
| 241 | Urban Rush | No verified image in first pass | No exact licensed studio photograph surfaced. |
| 242 | Vecher s Vladimirom Solovyovym | No verified image in first pass | No exact licensed studio photograph surfaced. |
| 243 | Vendredi c'est Julie | No verified image in first pass | No exact licensed studio photograph surfaced. |
| 244 | Viererkette | No verified image in first pass | No exact licensed studio photograph surfaced. |
| 245 | Vilket Drama | No verified image in first pass | No exact licensed studio photograph surfaced. |


## First-pass checks: records #246–#260

Checked 8 November 2026. One additional verified image was found and added.

| # | Program | First-pass result | Notes |
|---:|---|---|---|
| 246 | VIVA Live | No verified image in first pass | No exact licensed studio photograph surfaced. |
| 247 | Voetbal International | Verified image added | Exact studio set photo under the later title Voetbal Inside; CC BY-SA 4.0; see attribution manifest. |
| 248 | We the Students | No verified image in first pass | No exact licensed studio photograph surfaced. |
| 249 | Weekend Sunrise | No verified image in first pass | No openly licensed photograph of the actual set verified. |
| 250 | White Line Fewer | No exact match verified | Program identity remains unclear; no exact licensed set image found. |
| 251 | Willkommen Österreich | Verified image added | Actual filming photograph with the studio table and broadcast backdrop; CC BY-SA 3.0 with Wikimedia VRT permission confirmation. See attribution manifest. |
| 582 | Gardeners' World | Verified image added | Monty Don recording a piece to camera for the named BBC program at Gardeners' World Live; CC BY-SA 3.0. See attribution manifest. |
| 252 | Witch Hunt | No verified image in first pass | No openly licensed photograph of the actual set verified. |
| 253 | Wook Talk | No verified image in first pass | No exact licensed studio photograph surfaced. |
| 254 | WWE Confidential | No verified image in first pass | WWE archive references found, but no reusable set photo license established. |
| 255 | WWE Legends of Wrestling | No verified image in first pass | No exact licensed studio photograph surfaced. |
| 256 | On the Record w Britt Hume | No verified image in first pass | No exact licensed studio photograph surfaced. |
| 257 | Alfs-Hit-Talk-Show | No verified image in first pass | Program references found, but no openly licensed set photograph verified. |
| 258 | At the Movies | No verified image in first pass | Set references found, but no openly licensed photograph of the actual set verified. |
| 259 | Chevy-florida-insider-fishing-report | No verified image in first pass | No exact licensed studio photograph surfaced. |
| 260 | Die Kurt Kromer Show | No verified image in first pass | No openly licensed photograph of the actual set verified. |


## First-pass checks: records #261–#275

Checked 8 November 2026. No new photo passed exact-set and redistribution-license verification in this batch.

| # | Program | First-pass result | Notes |
|---:|---|---|---|
| 261 | Die-schoneberger-show | No verified image in first pass | Production credits found, but no openly licensed set photograph verified. |
| 262 | Everyday-Italian | No verified image in first pass | Food Network confirms the show used rented homes rather than a fixed studio; no openly licensed exact-set photo verified. |
| 263 | Faith-Under-Fire | No verified image in first pass | Studio references found, but no openly licensed set photograph surfaced. |
| 264 | Girl-TV | No verified image in first pass | No exact licensed studio photograph surfaced. |
| 265 | Izzet-Yildizhan-Show | No verified image in first pass | No exact licensed studio photograph surfaced. |
| 266 | Kangxi lai le | No verified image in first pass | No exact licensed studio photograph surfaced. |
| 267 | l-isola-dei-famosi | No verified image in first pass | Studio and set references found, but no openly licensed exact-set photograph verified. |
| 268 | Ie invasion barbariche | No verified image in first pass | Production source identifies the set designer, but no open image license was established. |
| 269 | Mark Lawson Talks to | No verified image in first pass | BBC program references found, but no openly licensed photograph of the set verified. |
| 270 | Marriage Uncensored | No exact match verified | Search results surfaced a newer Norwegian series with the same title; no exact match to this dataset record established. |
| 271 | Ministry-of-Mayhem | No verified image in first pass | No exact licensed studio photograph surfaced. |
| 272 | Muscle-Tv | No verified image in first pass | No exact licensed studio photograph surfaced. |
| 273 | Now You’re Talking | No exact match verified | Search results surfaced a Terry Wogan retrospective rather than the described morning show; identity needs follow-up. |
| 274 | Oi Pyles tou anexigitou | No verified image in first pass | No exact licensed studio photograph surfaced. |
| 275 | Pa-Paul | No verified image in first pass | No exact licensed studio photograph surfaced. |


## First-pass checks: records #276–#290

Checked 8 November 2026. No new photo passed exact-set and redistribution-license verification in this batch.

| # | Program | First-pass result | Notes |
|---:|---|---|---|
| 276 | Premise-de-Penser | No verified image in first pass | No exact licensed studio photograph surfaced. |
| 277 | PSYCHIC-INTERACTIVE | No verified image in first pass | Program history found, but no openly licensed image of its actual studio verified. |
| 278 | Redbar | No verified image in first pass | No exact licensed studio photograph surfaced. |
| 279 | Sanja | No exact match verified | Search results did not establish the exact show identity. |
| 280 | Saturday Night Darren and brose | No exact match verified | No reliable program identity or licensed set photograph established. |
| 281 | Shut up! It’s Stacy London | No verified image in first pass | No exact licensed studio photograph surfaced. |
| 282 | Staten-Island-Comedy-Show | No verified image in first pass | Show references found, but no openly licensed photograph of the actual set verified. |
| 283 | Stin-Igia-Mas | No exact match verified | Search results did not establish the exact program identity. |
| 284 | Sunday-Morning-Shootout | No verified image in first pass | No exact licensed studio photograph surfaced. |
| 285 | Sunday-Night-Live-with-Father | No exact match verified | No exact licensed studio photograph surfaced. |
| 286 | The Al Franken Show | No verified image in first pass | Radio studio references found, but no openly licensed set photograph verified. |
| 287 | The Graham Norton Effect | No verified image in first pass | No openly licensed photograph of the actual US set verified. |
| 288 | The Jimm Bakker Show | No verified image in first pass | Official studio photographs exist, but no open redistribution license was established. |
| 289 | The New Paul O Grady Show | No verified image in first pass | Exact show references found, but no openly licensed photograph of its set verified. |
| 290 | The Tim McCarver-Show | No verified image in first pass | No exact licensed studio photograph surfaced. |


## First-pass checks: records #291–#305

Checked 8 November 2026. No new photo passed exact-set and redistribution-license verification in this batch.

| # | Program | First-pass result | Notes |
|---:|---|---|---|
| 291 | The-Brini-Maxwell Show | No verified image in first pass | Set designer portfolio has exact set images, but no open redistribution license was established. |
| 292 | The Journal Editoral Report | No verified image in first pass | No exact licensed studio photograph surfaced. |
| 293 | The Tony Danza Show | No verified image in first pass | Actual set photographs and descriptions found, but the images are press/editorial copyrighted material. |
| 294 | Tout le monde enparle | No verified image in first pass | Exact set photos exist in press coverage; no open redistribution license verified. |
| 295 | Tubridy-Tonight | No verified image in first pass | No exact licensed studio photograph surfaced. |
| 296 | Tudo em Familia | No verified image in first pass | RTP archive confirms program identity, but explicitly restricts reproduction and redistribution without permission. |
| 297 | Unscrewed-with-Martin-Sargent | No verified image in first pass | No exact licensed studio photograph surfaced. |
| 298 | Unsere-Besten | No verified image in first pass | No exact licensed studio photograph surfaced. |
| 299 | Vitamin | No verified image in first pass | No exact licensed studio photograph surfaced. |
| 300 | Voce na TV | No verified image in first pass | No exact licensed studio photograph surfaced. |
| 301 | Zibb | No verified image in first pass | Official rbb studio photographs exist, but no open redistribution license was established. |
| 302 | AOL Sessions | No verified image in first pass | Getty results are mostly artist portraits and performance photos; no open license for set imagery verified. |
| 303 | Lijn4 | No verified image in first pass | No exact licensed studio photograph surfaced. |
| 304 | El show de Flo | No verified image in first pass | RTVE archive references found, but no openly licensed exact-set photograph verified. |
| 305 | Dopo Festival | No verified image in first pass | No exact licensed studio photograph surfaced. |


## First-pass checks: records #306–#320

Checked 8 November 2026. One additional image was verified and added.

| # | Program | First-pass result | Notes |
|---:|---|---|---|
| 306 | Jeena Isi ka Naam Hai | No verified image in first pass | Press galleries contain guest/on-location images, not a reusable exact studio-set image. |
| 307 | Big Brother's Return | No verified image in first pass | No exact licensed studio photograph surfaced. |
| 308 | V Graham Norton | No verified image in first pass | No exact licensed studio photograph surfaced. |
| 309 | Okna | No exact match verified | Program identity and exact studio image need further confirmation. |
| 310 | Donahue | Verified image added | UCLA Library / Los Angeles Times photograph from the actual show, CC BY 4.0; see attribution manifest. |
| 311 | Goedemorgan Nederland | No verified image in first pass | Commons image found is from a 2026 WNL program, not this 2002 show. |
| 312 | Wayne Brady Show | No verified image in first pass | No openly licensed photograph of the actual set verified. |
| 313 | John Walsh Show | No verified image in first pass | No exact licensed studio photograph surfaced. |
| 314 | Caroline Rhea Show | No verified image in first pass | Production references found, but no openly licensed set photograph verified. |
| 315 | Hannah | No exact match verified | Program identity remains ambiguous. |
| 316 | EWTN Live | No verified image in first pass | No exact licensed studio photograph surfaced. |
| 317 | Natvhtwatcht 2003 | No exact match verified | Likely title spelling issue; no exact program/set match verified. |
| 318 | Teen Talk | No verified image in first pass | Results surfaced unrelated teen-talk programs; no exact match verified. |
| 319 | Full Court Press | No exact match verified | Search results primarily identify a later sports/CSR campaign, not the described 2002 Maple Leafs program. |
| 320 | It’s my Life | No verified image in first pass | Studio location is documented, but no openly licensed photograph of the actual set verified. |


## First-pass checks: records #321–#335

Checked 8 November 2026. Record #325 is excluded from the decor-program scope by the app's genre filter.

| # | Program | First-pass result | Notes |
|---:|---|---|---|
| 321 | Enough Rope with Andrew Denton | No verified image in first pass | No exact licensed studio photograph surfaced. |
| 322 | Bei Stockl | No exact match verified | No exact program/set match established. |
| 323 | The Brice Kennedy Show | No verified image in first pass | No exact licensed studio photograph surfaced. |
| 324 | Tough Crowd with Colin Quinn | No verified image in first pass | No openly licensed photograph of the actual set verified. |
| 325 | Caso Cerrado con la Dra. Ana Maria Polo | Excluded from decor-program scope | App data classifies this as reality/competition/documentary outside the talk-show decor set. |
| 326 | RaiOt | No verified image in first pass | No exact licensed studio photograph surfaced. |
| 327 | Today with Des and Mel | No verified image in first pass | No exact licensed studio photograph surfaced. |
| 328 | Zelig | No verified image in first pass | Set-design photos exist in press/design coverage, but no open redistribution license was established. |
| 329 | Grumpy Old Men | No verified image in first pass | Program references confirm a studio production; no openly licensed set photo verified. |
| 330 | Center Stage | No exact match verified | Search results were ambiguous and did not establish the exact program. |
| 331 | Breakfast | No verified image in first pass | BBC studio images found through rights-managed sources; no open license verified. |
| 332 | Tatli ve Huysuz Show | No verified image in first pass | No exact licensed studio photograph surfaced. |
| 333 | Estudio Futbol | No verified image in first pass | A 2020 set photograph is reproduced in an academic PDF with source attributed to Google; original rights and reuse license are not established. |
| 334 | Teen Wire | No exact match verified | Search results did not establish the exact show identity. |
| 335 | Daily Politics | No verified image in first pass | Actual BBC studio photos exist in press coverage, but reuse license is not open. |


## First-pass checks: records #336–#350

Checked 8 November 2026. No new photo passed exact-set and redistribution-license verification in this batch.

| # | Program | First-pass result | Notes |
|---:|---|---|---|
| 336 | This Week | No verified image in first pass | BBC studio photos found in editorial coverage; no open redistribution license verified. |
| 337 | Fraga Doktorn | No exact match verified | Search results surfaced a similarly named current SVT program, not a verified match to this record. |
| 338 | Jimmy Kimmel Live | No verified image in first pass | No exact licensed studio photograph surfaced. |
| 339 | Bibliotheque Medicis | No verified image in first pass | Library/location references found, but no openly licensed image of the actual program setup verified. |
| 340 | Pure 24 S2 E15 | No exact match verified | Exact series/program identity needs further confirmation. |
| 341 | Menschen bei Maischberger | No verified image in first pass | Studio photos found in press coverage, but no open redistribution license verified. |
| 342 | Che Tempo Che Fa | No verified image in first pass | No exact licensed studio photograph surfaced. |
| 343 | As Ti Tud Not Padu | No exact match verified | Program title spelling/identity could not be reliably confirmed. |
| 344 | Daniel prevost et Marc_olivier Frogiel se Crepent le Chignon | No exact match verified | No exact licensed studio photograph surfaced. |
| 345 | The Great Indian Laughter Challenge | No verified image in first pass | On-set photo galleries exist, but they are copyrighted editorial photos with no open reuse license. |
| 346 | Christ in prophecy with Dr. David Reagan | No verified image in first pass | No exact licensed studio photograph surfaced. |
| 347 | Real Time with Bill Maher | No verified image in first pass | Set photos are available through press/photo agencies, but no open redistribution license verified. |
| 348 | The Ellen DeGeners Show | No verified image in first pass | No exact licensed studio photograph surfaced. |
| 349 | Carlos vives Discusses His Influence on Colombian Musicians & Performs “Las Mujeres”_ The View | No verified image in first pass | Search results identify a guest segment on The View, not an independently reusable decor photo. |
| 350 | George Tonight-CBC | No verified image in first pass | No exact licensed studio photograph surfaced. |


## First-pass checks: records #351–#365

Checked 8 November 2026. No new photo passed exact-set and redistribution-license verification in this batch.

| # | Program | First-pass result | Notes |
|---:|---|---|---|
| 351 | Go Aften Danmark_ Fodboldtossen Ronni | No exact match verified | Program identity/title variant needs further confirmation. |
| 352 | Kachelmanns Spatausgabe-Das Kochen mit Karel Gott)2006( | No exact match verified | No exact licensed studio photograph surfaced. |
| 353 | Mustafas Show_del 2 av 2 | No exact match verified | No reliable match to an identifiable show established. |
| 354 | PIPEII_Aferdita Paqarada | No exact match verified | No exact licensed studio photograph surfaced. |
| 355 | The John Kerwin Show | No verified image in first pass | No exact licensed studio photograph surfaced. |
| 356 | You Hee-yeol's Sketchbook | No verified image in first pass | No openly licensed photograph of the actual performance/interview set verified. |
| 357 | Attack of the Show ! | No verified image in first pass | Commons category contains hosts, panels, autograph booths, and portraits, but no verified photo of the actual studio decor. |
| 358 | The Rachel Maddow Show | No verified image in first pass | A CC BY-SA image found is a guest portrait on set, not a decor photograph; rejected for this task. |
| 359 | The Ray Martin Show | No exact match verified | No exact licensed studio photograph surfaced. |
| 360 | The Steve Wilkos Show | No verified image in first pass | Studio photos found in a permit booklet and press coverage, but no open redistribution license verified. |
| 361 | The Secret Guide to Women's Health | No exact match verified | No exact licensed studio photograph surfaced. |
| 362 | The Talk | No verified image in first pass | Exact set galleries/design lookbooks exist, but no open redistribution license was established. |
| 363 | Crossing Over with John Edward | No verified image in first pass | No exact licensed studio photograph surfaced. |
| 364 | Cycology Today | No exact match verified | No exact licensed studio photograph surfaced. |
| 365 | Day Day Up | No verified image in first pass | Actual studio photos found through Getty/Corbis; rights-managed and not open for redistribution. |


## First-pass checks: records #366–#380

Checked 8 November 2026. Record #377 is excluded from the decor-program scope by the app's genre filter.

| # | Program | First-pass result | Notes |
|---:|---|---|---|
| 366 | Estat de Xoc | No exact match verified | No reliable exact program/set match established. |
| 367 | Fox Kids | No verified image in first pass | Search results mainly show presenters/behind-the-scenes, not the actual program set. |
| 368 | Gandang Gabi, Vice | No verified image in first pass | Official on-set photo galleries exist, but no open redistribution license was established. |
| 369 | Geneve e Chaud | No exact match verified | No exact licensed studio photograph surfaced. |
| 370 | Go Fridge | No verified image in first pass | Tencent/WeTV show stills exist, but no open redistribution license for set images was established. |
| 371 | Go Show | No exact match verified | No exact licensed studio photograph surfaced. |
| 372 | Made in Hollywood | No verified image in first pass | No openly licensed photograph of the actual recurring set verified. |
| 373 | Morgan & Platell | No exact match verified | No exact licensed studio photograph surfaced. |
| 374 | Mornings with Kerri Anne | No verified image in first pass | No openly licensed photograph of the actual set verified. |
| 375 | Movies 101 | No exact match verified | No exact licensed studio photograph surfaced. |
| 376 | MTV Select | No verified image in first pass | No exact licensed studio photograph surfaced. |
| 377 | Music Farm | Excluded from decor-program scope | App data classifies this as reality/competition/documentary outside the talk-show decor set. |
| 378 | Nexos | No exact match verified | No exact licensed studio photograph surfaced. |
| 379 | Penguins | No exact match verified | No exact licensed studio photograph surfaced. |
| 380 | The Legal Analyst | No exact match verified | No exact licensed studio photograph surfaced. |


## First-pass checks: records #381–#395

Checked 8 November 2026. Record #382 is excluded from the decor-program scope by the app's genre filter.

| # | Program | First-pass result | Notes |
|---:|---|---|---|
| 381 | The Other Half | No verified image in first pass | No exact licensed studio photograph surfaced. |
| 382 | Gyoretsuno Dekiru Horitsu Sodanjo | Excluded from decor-program scope | App data classifies this as a competition/reality/documentary outside the talk-show decor set. |
| 383 | Good Mythical Morning | No verified image in first pass | Recent studio-tour photography exists, but reuse license for the images is not established. |
| 384 | Shabekuri007 | No exact match verified | No exact licensed studio photograph surfaced. |
| 385 | Showbiz Tonight | No verified image in first pass | No openly licensed photograph of the actual CNN set verified. |
| 386 | Salvame Deluxe | No verified image in first pass | No exact licensed studio photograph surfaced. |
| 387 | Q & A | No verified image in first pass | ABC set photographs exist in editorial coverage, but no open redistribution license was established. |
| 388 | Dan Aykroyd's Out There | No exact match verified | No exact licensed studio photograph surfaced. |
| 389 | Greeks on the Roof | No verified image in first pass | No exact licensed studio photograph surfaced. |
| 390 | Carin 21:30 | No verified image in first pass | SVT archive confirms the show, but viewing rights are territorially restricted and no open image license was found. |
| 391 | Quite Frankly with Stephen A. Smith | No verified image in first pass | No exact licensed studio photograph surfaced. |
| 392 | T4 Sunday | No verified image in first pass | No exact licensed studio photograph surfaced. |
| 393 | The Colbert Report | No verified image in first pass | Commons candidate titled “Colbert Report studio” is a photograph of the queue outside the studio, not the set; rejected. |
| 394 | The Daily Habit | No verified image in first pass | No exact licensed studio photograph surfaced. |
| 395 | The Dame Edna Treatment | No verified image in first pass | Format uses a fictional health-retreat/location setting rather than a single recurring studio decor; no reusable exact-set photo verified. |


## First-pass checks: records #396–#410

Checked 8 November 2026. No new photo passed exact-set and redistribution-license verification in this batch.

| # | Program | First-pass result | Notes |
|---:|---|---|---|
| 396 | The Dan Patrick Show | No verified image in first pass | No exact licensed studio photograph surfaced. |
| 397 | The Tyra Banks Show | No verified image in first pass | No openly licensed photograph of the actual set verified. |
| 398 | The Wright Stuff | No verified image in first pass | No exact licensed studio photograph surfaced. |
| 399 | Tietjen und Hirschhausen | No verified image in first pass | Actual studio photos found through IMAGO, but they are rights-managed. |
| 400 | Tolgshow | No exact match verified | No exact licensed studio photograph surfaced. |
| 401 | The David Pakman Show | No verified image in first pass | No openly licensed photograph of the actual set verified. |
| 402 | The Doctors | No verified image in first pass | No exact licensed studio photograph surfaced. |
| 403 | The Edinburgh Show | No exact match verified | No exact licensed studio photograph surfaced. |
| 404 | The Fix | No verified image in first pass | No openly licensed photograph of the actual set verified. |
| 405 | The Great Indian Comedy Show | No verified image in first pass | No exact licensed studio photograph surfaced. |
| 406 | The Hour / George Stroumboulopoulos Tonight | No verified image in first pass | No openly licensed photograph of the actual CBC set verified. |
| 407 | The Jackrabbit Insider | No exact match verified | No exact licensed studio photograph surfaced. |
| 408 | The Late Late Show with James Corden | No verified image in first pass | Exact set galleries and press photos exist, but no open redistribution license was established. |
| 409 | The Late Show with Stephen Colbert | No verified image in first pass | Exact set galleries exist, but images found are copyrighted design/press material. |
| 410 | The Medyo Late Night Show with Jojo A | No exact match verified | No exact licensed studio photograph surfaced. |



---

# Ongoing research status — 8 November 2026

This section records the continued work after the first-pass review through record #410.

## Verified data status

- Decor-program scope selected by the app's current filter: **1,161 records**.
- Records with any `images[]` entry (including ignored legacy local paths): **535**.
- Records with a displayable external seed-image URL: **21** records / **20 unique sources**.
- Records with legacy local paths only, intentionally skipped by the UI: **514**.
- Records with no `images[]` entry: **626**.
- Records without a displayable seed image in a clean install: **1,140**.
- Verified unique image sources recorded in the attribution file: **15**.
- Duplicate catalog entry #816 (Full Frontal with Samantha Bee) now reuses the same licensed set photograph as #39; this fills the duplicate record but does not increase the unique-image-source count.
- New unique images added in this continuation: **13** — #151 Lafer! Lichter! Lecker!, #251 Willkommen Österreich, #582 Gardeners' World, #717 Top Gear, #767 Antiques Roadshow, #1131 Radio 1's Big Weekend, #1227 Comic Book Men, #1268 Dragons' Den, #419 Morning Joe, #467 The Daily Show, #521 The Oprah Winfrey Show, #522 Meet The Press, and #542 Conan.
- All new image URLs were checked against the app's existing image-loading path. The app selects external HTTPS URLs from `show.images[]` and renders them as real images for logged-in users; no UI or genre logic was changed.

## Additional research batches

The following records have been researched and their findings documented in separate batch files:

- #574–593 — gardening programs
- #594–648 — Christmas, police, Ramadan and documentary titles
- #649–690 — Indonesian, Malaysian and Qatari Ramadan programs
- #691–704 — travel / reality programs
- #705–744 — travel and food programs
- #745–817 — travel, antiques, film-review and talk-show records
- #818–934 — constitution and espionage documentaries
- #935–1024 — espionage and prison documentaries
- #1025–1156 — reality, late-night, radio and podcast programs
- #1157–1221 — farming, gardening and book programs
- #1222–1302 — book, business and entrepreneurship programs

## Newly verified image sources

| Record | Program | License | Source |
|---:|---|---|---|
| 151 | Lafer! Lichter! Lecker! | CC BY-SA 3.0 DE | Wikimedia Commons — Udo Grimberg |
| 717 | Top Gear | CC BY 2.0 | Wikimedia Commons — Barry McGee |
| 767 | Antiques Roadshow | CC BY-SA 2.0 | Wikimedia Commons — Portable Antiquities Scheme |
| 1131 | Radio 1's Big Weekend | CC BY-SA 2.0 | Wikimedia Commons — Paul Denchfield |
| 1227 | Comic Book Men | CC BY 3.0 | Wikimedia Commons — Luigi Novi |
| 1268 | Dragons' Den | CC BY 3.0 | Wikimedia Commons — Adam Wimpenny |
| 251 | Willkommen Österreich | CC BY-SA 3.0 | Wikimedia Commons — Hannes Sallmutter (VRT permission confirmed) |
| 582 | Gardeners' World | CC BY-SA 3.0 | Wikimedia Commons — Andy Mabbett |

Full creator, date, source, image URL and license details are maintained in `docs/PROGRAM-IMAGE-ATTRIBUTION.md`.

## Important exclusions

- Presenter/guest portraits that do not show the program environment.
- Logos, posters and key art.
- Images from another country's version of the same format.
- Generic locations, unrelated events and lookalike studio sets.
- Official broadcaster/production stills without a stated open reuse license.
- Images that depict the topic of a documentary but not its actual production environment.

## Completion state

Research is **not complete**. Only 21 of 1,161 decor-filter records have displayable external seed-image URLs (20 unique sources). A further 514 records contain only legacy local paths that the UI deliberately ignores, and 626 have no `images[]` entry. Thus 1,140 records currently have no displayable seed image in a clean install. The PR remains a draft and has not been merged. Continue searching for exact, reusable set/production-environment photographs; do not lower the matching or licensing standard merely to force every record to have an image.


## Records with no `images[]` entry by data category (626)

This is only the 626 records with an empty image array. It does not include the additional 514 legacy-local-path-only records, which are also not displayable.

| Category | Missing |
|---|---:|
| جاسوسی | 154 |
| سفر جاده‌ای | 90 |
| رمضان | 63 |
| سرمایه‌گذاری در تولید | 60 |
| رادیو تصویری | 49 |
| روستا | 44 |
| کتاب و کتاب‌خوانی | 29 |
| کاشت درخت | 19 |
| پلیسی | 19 |
| زندان | 18 |
| اهدای عضو | 18 |
| کریسمس | 15 |
| تاریخی | 15 |
| نقد فیلم | 11 |
| قانون اساسی | 9 |
| تاک‌شوی سیاسی و خبری | 5 |
| تاک‌شوی تخصصی و سبک زندگی | 3 |
| تاک‌شوی طنز و کمدی | 2 |
| تاک‌شوی مصاحبه‌محور | 2 |
| تاک‌شوی موقعیت‌محور/خارج از استودیو | 1 |

## Legacy local-path-only records by data category (514)

These records have one or more local `/program-images/...` paths but no external URL. The app intentionally skips these paths because they are not verified decor photographs.

| Category | Records |
|---|---:|
| ۳. تاک‌شوی مصاحبه‌محور | 99 |
| ۷. تاک‌شوی طنز و کمدی | 84 |
| ۴. تاک‌شوی سیاسی و خبری | 60 |
| ۱۲. تاک‌شوی فرهنگی، هنری و روشنفکری | 51 |
| ۱۳. تاک‌شوی تخصصی و سبک زندگی | 48 |
| ۶. تاک‌شوی گروهی سلبریتی‌ها | 41 |
| ۹. تاک‌شوی پنلی و میزگرد | 23 |
| نیازمند بررسی/فرمت ترکیبی | 22 |
| ۲. تاک‌شوی روزانه/صبحگاهی | 19 |
| ۱. تاک‌شوی شبانه | 14 |
| ۱۴. تاک‌شوی صنعت سرگرمی/پشت‌صحنه | 13 |
| ۸. تاک‌شوی موقعیت‌محور/خارج از استودیو | 11 |
| ۱۶. تاک‌شوی دیجیتال/اینترنتی | 10 |
| ۵. تاک‌شوی روابط و تعارض | 8 |
| ۱۵. تاک‌شوی رادیویی/صوتی | 6 |
| ۱۱. تاک‌شوی انسانی و داستان‌محور | 5 |


This distribution explains why a large part of the remaining queue does not have a conventional studio set: 154 are espionage documentaries, 90 travel-road formats, 63 Ramadan programs, 44 rural programs, and 18 prison documentaries. These are still in the requested decor-filter scope; they are not silently removed. They require a program-specific filming environment or set photograph, not an unrelated subject photograph. The remaining 14 records in explicitly named talk-show categories remain high-priority for further exact-set searches.
