# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: layout-presets.spec.ts >> Project layout presets >> Classic layout shows staging plan and crew schedule tabs
- Location: features/layout-presets.spec.ts:21:7

# Error details

```
Test timeout of 120000ms exceeded.
```

```
Error: locator.click: Test timeout of 120000ms exceeded.
Call log:
  - waiting for getByRole('listbox', { name: 'Project layout' }).getByRole('option', { name: 'Classic', exact: true })

```

# Page snapshot

```yaml
- generic [ref=e4]:
  - complementary [ref=e5]:
    - generic [ref=e6]:
      - link "Portal Control Panel" [ref=e8] [cursor=pointer]:
        - /url: /admin
        - img [ref=e10]
        - generic [ref=e12]:
          - paragraph [ref=e13]: Portal
          - paragraph [ref=e14]: Control Panel
      - navigation [ref=e15]:
        - generic [ref=e16]:
          - paragraph [ref=e17]: Overview
          - generic [ref=e18]:
            - link "Dashboard" [ref=e19] [cursor=pointer]:
              - /url: /admin
              - img [ref=e20]
              - text: Dashboard
            - link "Users & Roles" [ref=e25] [cursor=pointer]:
              - /url: /admin/users
              - img [ref=e26]
              - text: Users & Roles
            - link "Settings" [ref=e31] [cursor=pointer]:
              - /url: /admin/settings
              - img [ref=e32]
              - text: Settings
            - link "Site Menu" [ref=e35] [cursor=pointer]:
              - /url: /admin/site-menu
              - img [ref=e36]
              - text: Site Menu
            - link "Site Content" [ref=e37] [cursor=pointer]:
              - /url: /admin/site-content
              - img [ref=e38]
              - text: Site Content
        - generic [ref=e41]:
          - paragraph [ref=e42]: Workspace
          - generic [ref=e43]:
            - link "Projects" [ref=e44] [cursor=pointer]:
              - /url: /projects
              - img [ref=e45]
              - text: Projects
            - link "Quotes" [ref=e47] [cursor=pointer]:
              - /url: /admin/quotes
              - img [ref=e48]
              - text: Quotes
            - link "Field Tool" [ref=e51] [cursor=pointer]:
              - /url: /field
              - img [ref=e52]
              - generic [ref=e55]: Field Tool
        - generic [ref=e56]:
          - paragraph [ref=e57]: Site
          - link "View Public Site" [ref=e58] [cursor=pointer]:
            - /url: /
            - img [ref=e59]
            - text: View Public Site
      - generic [ref=e62]:
        - generic [ref=e63]:
          - paragraph [ref=e64]: WGDS Owner
          - paragraph [ref=e65]: admin · admin@whiteglovedeliverync.com
        - button "Sign Out" [ref=e66]:
          - img [ref=e67]
          - text: Sign Out
  - generic [ref=e70]:
    - banner [ref=e71]:
      - generic [ref=e73]:
        - paragraph [ref=e74]: White Glove · Admin
        - heading "Project" [level=1] [ref=e75]
      - generic [ref=e76]:
        - button "Notifications, 15 unread" [ref=e78]:
          - img [ref=e79]
          - generic [ref=e82]: "15"
        - link "Public Site" [ref=e83] [cursor=pointer]:
          - /url: /
          - img [ref=e84]
          - text: Public Site
    - main [ref=e87]:
      - paragraph [ref=e89]: Automated E2E test project
      - generic [ref=e90]:
        - generic [ref=e91]:
          - generic [ref=e92]:
            - generic [ref=e93]:
              - text: Phase 1 — Planning
              - heading "E2E Project 1781889143619" [level=2] [ref=e94]
            - generic [ref=e95]:
              - generic [ref=e96]:
                - 'button "Layout: Classic" [expanded] [active] [ref=e97]':
                  - img [ref=e98]
                  - generic [ref=e103]: "Layout:"
                  - generic [ref=e104]: Classic
                  - img [ref=e105]
                - button "Close layout menu" [ref=e107]
                - listbox "Project layout" [ref=e108]:
                  - paragraph [ref=e109]: Your saved view
                  - option "Classic Full project header, timeline on every tab, scope tools on Staging Plan." [selected] [ref=e110]:
                    - generic [ref=e111]:
                      - generic [ref=e112]:
                        - paragraph [ref=e113]: Classic
                        - paragraph [ref=e114]: Full project header, timeline on every tab, scope tools on Staging Plan.
                      - img [ref=e115]
                  - option "Operations Inventory first — piece list up top, labels and signoffs collapsed." [ref=e117]:
                    - generic [ref=e119]:
                      - paragraph [ref=e120]: Operations
                      - paragraph [ref=e121]: Inventory first — piece list up top, labels and signoffs collapsed.
                  - option "Admin Dedicated Changes tab, tiered header, timeline only on inventory and plan." [ref=e122]:
                    - generic [ref=e124]:
                      - paragraph [ref=e125]: Admin
                      - paragraph [ref=e126]: Dedicated Changes tab, tiered header, timeline only on inventory and plan.
                  - option "Compact Minimal chrome — slim timeline, schedule merged into plan, fewer tabs." [ref=e127]:
                    - generic [ref=e129]:
                      - paragraph [ref=e130]: Compact
                      - paragraph [ref=e131]: Minimal chrome — slim timeline, schedule merged into plan, fewer tabs.
              - button "Export PDF" [ref=e133]:
                - img [ref=e134]
                - text: Export PDF
                - img [ref=e137]
          - button "Saved PDFs (0) View all" [ref=e141]:
            - generic [ref=e142]:
              - img [ref=e143]
              - text: Saved PDFs (0)
            - generic [ref=e146]: View all
          - generic [ref=e147]:
            - generic [ref=e148]:
              - img [ref=e149]
              - generic [ref=e152]:
                - paragraph [ref=e153]: Property
                - paragraph [ref=e154]: 1200 Market St, High Point, NC, NC
            - generic [ref=e155]:
              - img [ref=e156]
              - generic [ref=e158]:
                - paragraph [ref=e159]: Target Install
                - paragraph [ref=e160]: Aug 15, 2026
            - generic [ref=e161]:
              - img [ref=e162]
              - generic [ref=e165]:
                - paragraph [ref=e166]: Designer
                - paragraph [ref=e167]: Sarah Whitfield — Whitfield Interiors
            - generic [ref=e168]:
              - img [ref=e169]
              - generic [ref=e173]:
                - paragraph [ref=e174]: Client
                - paragraph [ref=e175]: E2E User 1781889143619
          - generic [ref=e176]:
            - paragraph [ref=e177]: Locked pricing (from quote)
            - generic [ref=e178]:
              - generic [ref=e179]:
                - paragraph [ref=e180]: Mile rate
                - paragraph [ref=e181]: $4/mi
              - generic [ref=e182]:
                - paragraph [ref=e183]: Coordination
                - paragraph [ref=e184]: $350
              - generic [ref=e185]:
                - paragraph [ref=e186]: Extra pickup
                - paragraph [ref=e187]: $175
              - generic [ref=e188]:
                - paragraph [ref=e189]: Min quote
                - paragraph [ref=e190]: $750
        - generic [ref=e191]:
          - paragraph [ref=e192]: Project Workflow
          - generic [ref=e193]:
            - generic [ref=e194]:
              - generic [ref=e195]:
                - generic [ref=e196]: "1"
                - generic [ref=e197]: Planning & Staging
              - paragraph [ref=e198]: Pieces identified, rooms assigned, and staging plan documented.
              - paragraph [ref=e199]: 3 pieces
              - generic [ref=e200]: Current
            - generic [ref=e201]:
              - generic [ref=e202]:
                - generic [ref=e203]: "2"
                - generic [ref=e204]: Pickup & Storage
              - paragraph [ref=e205]: Multi-location pickups, condition verification, and warehouse storage.
              - paragraph [ref=e206]: 0 pieces
            - generic [ref=e207]:
              - generic [ref=e208]:
                - generic [ref=e209]: "3"
                - generic [ref=e210]: Installation
              - paragraph [ref=e211]: Delivered and installed at showroom or final site on schedule.
              - paragraph [ref=e212]: 0 pieces
          - generic [ref=e213]:
            - generic [ref=e214]:
              - paragraph [ref=e215]: Install Date
              - paragraph [ref=e216]: Aug 15, 2026
            - generic [ref=e217]:
              - paragraph [ref=e218]: Status
              - paragraph [ref=e219]: Phase 1 — Planning
          - button "Advance to Phase 2 — Pickup & Storage" [ref=e221]:
            - img [ref=e222]
            - text: Advance to Phase 2 — Pickup & Storage
        - generic [ref=e224]:
          - button "Inventory" [ref=e225]
          - button "Staging Plan" [ref=e226]
          - button "Crew Schedule" [ref=e227]
          - button "Contract" [ref=e228]
          - button "Record & Audit" [ref=e229]
        - generic [ref=e230]:
          - generic [ref=e231]:
            - generic [ref=e232]:
              - generic [ref=e233]:
                - img [ref=e234]
                - heading "Inventory Labels" [level=3] [ref=e238]
              - paragraph [ref=e239]: 3 labels · E2E Project 1781889143619
            - generic [ref=e240]:
              - generic [ref=e241]:
                - text: Avery sheet
                - combobox "Avery sheet" [ref=e242]:
                  - option "Avery 5160 — 1\" × 2⅝\" address labels — 30 per sheet (3×10)"
                  - option "Avery 5161 — 1\" × 4\" shipping labels — 20 per sheet (2×10)"
                  - option "Avery 5162 — 1⅓\" × 4\" shipping labels — 14 per sheet (2×7)"
                  - option "Avery 5163 — 2\" × 4\" shipping labels — 10 per sheet (2×5)" [selected]
                  - option "Avery 5164 — 3⅓\" × 4\" shipping labels — 6 per sheet (2×3)"
              - button "Download PDF" [ref=e243]:
                - img [ref=e244]
                - text: Download PDF
              - button "Save to project" [ref=e247]:
                - img [ref=e248]
                - text: Save to project
          - paragraph [ref=e252]: 2" × 4" shipping labels — 10 per sheet (2×5). Download a print-ready PDF with dashed borders around each label slot. Scan any QR code to open the piece check-in page.
          - generic [ref=e253]:
            - paragraph [ref=e254]: Saved versions
            - paragraph [ref=e255]: No saved label PDFs yet.
          - button "Show print preview" [ref=e256]:
            - img [ref=e257]
            - text: Show print preview
        - generic [ref=e259]:
          - heading "Inventory Signoffs" [level=3] [ref=e260]
          - paragraph [ref=e261]: Designer and client approval at each project phase. Download a signoff PDF for insurance or client records.
          - generic [ref=e262]:
            - generic [ref=e263]:
              - generic [ref=e264]:
                - paragraph [ref=e265]: Planning & Staging
                - button "PDF" [ref=e266]:
                  - img [ref=e267]
                  - text: PDF
              - button "Sign as Designer" [ref=e271]:
                - img [ref=e272]
                - text: Sign as Designer
            - generic [ref=e274]:
              - generic [ref=e275]:
                - paragraph [ref=e276]: Pickup & Storage
                - button "PDF" [ref=e277]:
                  - img [ref=e278]
                  - text: PDF
              - generic [ref=e281]:
                - button "Sign as Designer" [ref=e282]:
                  - img [ref=e283]
                  - text: Sign as Designer
                - button "Sign as Client" [ref=e285]:
                  - img [ref=e286]
                  - text: Sign as Client
            - generic [ref=e288]:
              - generic [ref=e289]:
                - paragraph [ref=e290]: Installation
                - button "PDF" [ref=e291]:
                  - img [ref=e292]
                  - text: PDF
              - generic [ref=e295]:
                - button "Sign as Designer" [ref=e296]:
                  - img [ref=e297]
                  - text: Sign as Designer
                - button "Sign as Client" [ref=e299]:
                  - img [ref=e300]
                  - text: Sign as Client
        - generic [ref=e302]:
          - generic [ref=e303]:
            - paragraph [ref=e304]: "3"
            - paragraph [ref=e305]: Planning & Staging
          - generic [ref=e306]:
            - paragraph [ref=e307]: "0"
            - paragraph [ref=e308]: Pickup & Storage
          - generic [ref=e309]:
            - paragraph [ref=e310]: "0"
            - paragraph [ref=e311]: Installation
        - generic [ref=e312]:
          - button "All (3)" [ref=e313]
          - button "Living Room (2)" [ref=e314]
          - button "Primary Bedroom (1)" [ref=e315]
        - generic [ref=e316]:
          - button "Accent Chair (1 of 2) Planning & Staging On inventory manifest — awaiting pickup Identified Excellent" [ref=e317]:
            - generic [ref=e318]:
              - generic [ref=e320]: No photo
              - generic [ref=e321]:
                - paragraph [ref=e322]:
                  - text: Accent Chair (1 of 2)
                  - img [ref=e323]
                - paragraph [ref=e325]: Planning & Staging
                - paragraph [ref=e326]: On inventory manifest — awaiting pickup
              - generic [ref=e327]:
                - generic [ref=e328]: Identified
                - generic [ref=e329]: Excellent
          - button "Accent Chair (2 of 2) Planning & Staging On inventory manifest — awaiting pickup Identified Excellent" [ref=e330]:
            - generic [ref=e331]:
              - generic [ref=e333]: No photo
              - generic [ref=e334]:
                - paragraph [ref=e335]:
                  - text: Accent Chair (2 of 2)
                  - img [ref=e336]
                - paragraph [ref=e338]: Planning & Staging
                - paragraph [ref=e339]: On inventory manifest — awaiting pickup
              - generic [ref=e340]:
                - generic [ref=e341]: Identified
                - generic [ref=e342]: Excellent
          - button "Dining Chair Planning & Staging On inventory manifest — awaiting pickup Identified Excellent" [ref=e343]:
            - generic [ref=e344]:
              - generic [ref=e346]: No photo
              - generic [ref=e347]:
                - paragraph [ref=e348]:
                  - text: Dining Chair
                  - img [ref=e349]
                - paragraph [ref=e351]: Planning & Staging
                - paragraph [ref=e352]: On inventory manifest — awaiting pickup
              - generic [ref=e353]:
                - generic [ref=e354]: Identified
                - generic [ref=e355]: Excellent
```

# Test source

```ts
  1  | import { expect, type Page } from '@playwright/test';
  2  | 
  3  | const LAYOUT_LABELS = {
  4  |   classic: 'Classic',
  5  |   operations: 'Operations',
  6  |   admin: 'Admin',
  7  |   compact: 'Compact',
  8  | } as const;
  9  | 
  10 | export type ProjectLayoutId = keyof typeof LAYOUT_LABELS;
  11 | 
  12 | export async function openProject(page: Page, projectId: string) {
  13 |   await page.goto(`/project/${projectId}`);
  14 |   await expect(page.getByRole('heading', { level: 2 }).first()).toBeVisible({ timeout: 20_000 });
  15 | }
  16 | 
  17 | export async function selectProjectLayout(page: Page, layoutId: ProjectLayoutId) {
  18 |   const label = LAYOUT_LABELS[layoutId];
  19 |   await page.getByRole('button', { name: /Layout:/ }).click();
  20 |   const listbox = page.getByRole('listbox', { name: 'Project layout' });
  21 |   await expect(listbox).toBeVisible();
> 22 |   await listbox.getByRole('option', { name: label, exact: true }).click();
     |                                                                   ^ Error: locator.click: Test timeout of 120000ms exceeded.
  23 |   await expect(page.getByRole('button', { name: new RegExp(`Layout:\\s*${label}`) })).toBeVisible();
  24 | }
  25 | 
  26 | export async function clickProjectTab(page: Page, tabLabel: string) {
  27 |   await page.getByRole('button', { name: tabLabel, exact: true }).click();
  28 | }
  29 | 
  30 | export async function addCatalogItemToFirstRoom(page: Page) {
  31 |   const pieceSelect = page.getByLabel('Add piece from catalogue').locator('select').first();
  32 |   await expect(pieceSelect.locator('option')).not.toHaveCount(1, { timeout: 20_000 });
  33 |   const firstValue = await pieceSelect.locator('option').nth(1).getAttribute('value');
  34 |   expect(firstValue).toBeTruthy();
  35 |   await pieceSelect.selectOption(firstValue!);
  36 | }
  37 | 
```