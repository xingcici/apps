<h1 align="center">bimmer-lab apps</h1>

此分支提供 **仪表主题 0.19.3** 和 **HUD 小组件 0.15.1** 简体中文版，商店源为 `xingcici/apps`。设置菜单、提示和仪表数据标签使用中文，单位与车型标识保持原样。

仪表主题在熄火后、仪表仍亮着时继续显示，需要 `cluster-render 0.6.4` 或更新版本。车辆休眠后不会继续点亮仪表。主题仍按所选驾驶模式切换；若希望舒适、节能模式也显示，请分别选择主题，或关闭“随驾驶模式切换”。HUD 小组件保留熄火时撤下图层、车辆就绪后恢复的行为。

个人版本发布：先修改此仓库、提高受影响应用的 `app.json` 版本并通过检查，再推送 `xingcici/apps` 的 `main`，最后在商店检查更新。商店从 Git 提交在车机上用真实 SDK 构建；本地 stub SDK 产物不能上传车机。每次更新前保留应用 `data/` 设置，不能只修改已安装的脚本。

构建与检查：`python3 kit/tools/build.py cluster_themes idrive_hud_widgets`，然后运行 `node tools/test_localization.js`、`node tools/test_cluster_startup.js`、`node tools/test_cluster_rebuild.js` 和 `node tools/test_auto_shift.js`。补充中文字形时，用 Google Fonts 的 Noto Sans SC 字体运行 `uv run --no-project --with pillow python tools/bake_chinese.py /path/to/NotoSansSC.ttf`；字体许可见 `kit/runtime/fonts/OFL-NotoSansSC.txt`。

<p align="center">Apps for BMW iDrive 7 head units (MGU), installed through the community MGU Store.</p>

<p align="center"><img src="docs/images/cluster-gt3.gif" width="900" alt="GT3 race dash on the instrument cluster"></p>

## Cluster Themes

<img src="apps/cluster_themes/icon.png" width="72" align="left" alt="Cluster Themes icon">

Redraws the whole instrument cluster in a theme of your choice: a GT3 race dash, an M-style cluster, an M view like the newer M cars, Vector with a music panel, a Sport view, Minimal, Track, Drag with a 0 to 60 timer, Rally with a G-meter, Retro 80s, Cruise, Dyno, a tile dash in BMW M colours, or Ribbon, with holiday editions. Pick the theme on the center screen, or let it follow the SPORT / COMFORT / ECO PRO buttons. [Read more](apps/cluster_themes/README.md)

<p align="center"><img src="docs/images/cluster-gt3-shift.png" width="900" alt="GT3 theme at the shift point"></p>
<p align="center"><img src="docs/images/cluster-m.png" width="900" alt="M theme"></p>
<p align="center"><img src="docs/images/cluster-sport.png" width="900" alt="Sport theme"></p>
<p align="center"><img src="docs/images/cluster-dyno.png" width="900" alt="Dyno theme"></p>

## HUD Widgets

<img src="apps/idrive_hud_widgets/icon.png" width="72" align="left" alt="HUD Widgets icon">

Puts your own readouts on the windshield HUD: gear, shift lights, boost, oil, coolant and intake temperatures, a G-meter and trip figures. Ten layouts, in Classic, M and Night colours (Cruise and Retro bring their own). [Read more](apps/idrive_hud_widgets/README.md)

<p align="center"><img src="docs/images/hud-redline.gif" width="600" alt="Redline layout on the HUD"></p>

<table align="center">
  <tr>
    <th align="center">Daily</th>
    <th align="center">Sport</th>
    <th align="center">Redline</th>
  </tr>
  <tr>
    <td><img src="docs/images/hud-daily.png" width="300" alt="Daily layout"></td>
    <td><img src="docs/images/hud-sport.png" width="300" alt="Sport layout"></td>
    <td><img src="docs/images/hud-redline.png" width="300" alt="Redline layout at the shift point"></td>
  </tr>
</table>

## Setting up

Each app has its own page on the center screen, opened from the apps menu. Pick a theme or layout there, give each drive mode its own, choose what every readout shows, and set your time zone and units.

<p align="center"><img src="docs/images/page-cluster-themes.png" width="900" alt="Cluster Themes page on the center screen"></p>
<p align="center"><img src="docs/images/page-hud-layouts.png" width="900" alt="HUD Widgets page on the center screen"></p>

## Install

1. Install **cluster-render** first. Both apps draw through it. It comes from the `robertnisipeanu/idrive-apps` Store source. With version 0.5.1 or newer, a cluster theme and a HUD layout can show at the same time.
2. In the Store, go to **Settings, Add source**, enter **`xingcici/apps`**, and install the apps you want.
3. Open the app from the apps menu on the center screen to pick a theme or layout.
4. The head unit's clock runs on UTC, so set **Settings, Time zone (clock)** to your zone once (for example US Eastern). Named zones change for daylight saving by themselves.

The Store builds each app on the car from this repo. No BMW code is in it. Both apps are tested on a 2020 X3 M40i; each app's page says what has been checked on the car and what is still open. Version history is in [CHANGELOG.md](CHANGELOG.md).

## Use at your own risk

These are unofficial apps made by hobbyists. They are not made, approved or supported by BMW, and the people who wrote them are not responsible for anything that happens to your car or to you while using them.

- Installing apps that don't come from BMW on your head unit is done at your own risk and may affect your warranty.
- The apps only read data from the car. They never write to or change any control unit.
- A cluster theme or HUD layout draws over BMW's own displays. Readouts are for information only: don't rely on them for safety, and always follow BMW's own warnings. If anything looks wrong, pick Off and BMW's display comes back.
- Don't set up or change the apps while driving. Keep your eyes on the road.
- The apps are provided as is, without any warranty, under the MIT licence. You use them entirely at your own risk.

## Credits

- [cauliflowermossgrape/idrive7-apps](https://github.com/cauliflowermossgrape/idrive7-apps): the MGU App Kit (MIT) these apps are built on, and the Redline app the shift scoring comes from (Redline's HUD by [@biscotit](https://github.com/biscotit)).
- [robertnisipeanu/idrive-apps](https://github.com/robertnisipeanu/idrive-apps): cluster-render, which draws on the HUD and the cluster.
- Barlow, Michroma and Orbitron typefaces (SIL Open Font License).

## Licence

MIT. Third-party parts are listed in each app's `NOTICE`. To work on the apps, see [docs/DEVELOPING.md](docs/DEVELOPING.md).
