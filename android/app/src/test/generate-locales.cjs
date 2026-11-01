'use strict';
const fs=require('node:fs'),path=require('node:path');
const source=process.argv[2];if(!source)throw Error('Pass canonical desktop source directory');
const rows=require(path.join(source,'wwwroot/locales.js')).map(row=>[...row]);
// Mobile-specific messages are additions; exact common desktop messages are retained.
const native=`
For you|Для вас|Für dich
Explore|Обзор|Entdecken
My profile|Моё|Mein Profil
New works|Новое|Neue Werke
All|Всё|Alle
SFW|Обычное|SFW
Latest|Новые|Neueste
Popular|Популярные|Beliebt
Search illustrations|Поиск иллюстраций|Illustrationen suchen
Artwork|Иллюстрация|Werk
Illustrations|Иллюстрации|Illustrationen
All connected sources|Все подключённые источники|Alle verbundenen Quellen
Artist|Художник|Künstler
Creator not specified|Автор не указан|Urheber nicht angegeben
More works by the artist|Другие работы автора|Weitere Werke des Künstlers
Following artists|Подписки на художников|Gefolgte Künstler
Follow artist|Подписка на художника|Künstler folgen
Follow|Подписаться|Folgen
Following|Вы подписаны|Gefolgt
Unfollow|Отписаться|Nicht mehr folgen
Add artist tag|Добавить тег художника|Künstler-Tag hinzufügen
Artist tag, for example artist_name|Тег художника, например artist_name|Künstler-Tag, zum Beispiel artist_name
Enter one artist tag|Введите один тег художника|Einen Künstler-Tag eingeben
Enter the artist's catalog tag. One tag searches all connected catalogs.|Укажите тег художника из источника. Один тег ищется во всех подключённых каталогах.|Gib den Künstler-Tag aus dem Katalog ein. Der Tag wird in allen verbundenen Katalogen gesucht.
New works in this feed|Новые работы в ленте|Neue Werke in diesem Feed
No works yet|Пока нет работ|Noch keine Werke
No results|Ничего не найдено|Keine Ergebnisse
Loading…|Загрузка…|Wird geladen…
Loading more…|Загружаем ещё…|Weitere Werke werden geladen…
Retry|Повторить|Erneut versuchen
Tap to retry|Нажмите, чтобы повторить|Zum Wiederholen tippen
Retry loading|Повторить загрузку|Laden wiederholen
Refresh feed|Обновить ленту|Feed aktualisieren
Sources are temporarily unavailable|Источники временно недоступны|Quellen sind vorübergehend nicht verfügbar
Image unavailable|Изображение недоступно|Bild nicht verfügbar
Open artwork|Открыть иллюстрацию|Werk öffnen
Open original|Открыть оригинал|Original öffnen
Download original|Скачать оригинал|Original herunterladen
Open on website|Открыть на сайте|Auf Website öffnen
Original source|Первоисточник|Originalquelle
View|Смотреть|Ansehen
Play video|Смотреть видео|Video abspielen
Loading video…|Загрузка видео…|Video wird geladen…
Video could not load. Tap to retry.|Не удалось загрузить видео. Нажмите, чтобы повторить.|Video konnte nicht geladen werden. Zum Wiederholen antippen.
Video preview unavailable|Превью видео недоступно|Videovorschau nicht verfügbar
Video paused|Видео на паузе|Video pausiert
Confirm profile transfer|Подтверждение переноса профиля|Profilübertragung bestätigen
I confirm importing this file into my profile|Я подтверждаю перенос этого файла в мой профиль|Ich bestätige den Import dieser Datei in mein Profil
Confirm transfer|Перенести|Übertragen
Selected profile file|Выбранный файл профиля|Ausgewählte Profildatei
DART profile|Профиль DART|DART-Profil
Video|Видео|Video
Animation|Анимация|Animation
Voice|Озвучка|Sprecher
Sound|Звук|Ton
Music|Музыка|Musik
Script|Сценарий|Text
Colorist|Колорист|Kolorist
Editing|Монтаж|Schnitt
Translation|Перевод|Übersetzung
Contributor|Участник|Mitwirkende Person
Like|Нравится|Gefällt mir
Liked|Понравилось|Gefällt mir
Remove like|Убрать из понравившегося|Gefällt mir entfernen
Removed from liked works|Убрано из понравившегося|Aus den Likes entfernt
Added to bookmarks|Добавлено в закладки|Zu Lesezeichen hinzugefügt
Removed from bookmarks|Убрано из закладок|Aus Lesezeichen entfernt
Bookmarks|Закладки|Lesezeichen
Liked works|Понравившееся|Likes
History|История|Verlauf
Search history|История запросов|Suchverlauf
Open works|Открытые работы|Offene Werke
Pin|Закрепить|Anheften
Unpin|Открепить|Loslösen
Close all|Закрыть все|Alle schließen
Clear all|Очистить всё|Alles leeren
Clear history|Очистить историю|Verlauf leeren
Appearance|Оформление|Darstellung
Language|Язык|Sprache
Language settings|Настройки языка|Spracheinstellungen
Privacy|Конфиденциальность|Datenschutz
Content|Контент|Inhalte
Creators|Авторы|Urheber
Sources|Источники|Quellen
Tabs|Вкладки|Tabs
Screen capture protection|Защита от снимков экрана|Schutz vor Bildschirmaufnahmen
Hide from screenshots and screen sharing|Скрывать в снимках экрана и демонстрации|In Bildschirmaufnahmen und Freigaben verbergen
Theme|Тема|Design
Light|Светлая|Hell
Dark|Тёмная|Dunkel
System|Системная|System
Artwork tabs|Вкладки работ|Werk-Tabs
Preview mode|Режим предпросмотра|Vorschaumodus
Open in a new tab|Открывать в новой вкладке|In neuem Tab öffnen
Content visibility|Видимость контента|Sichtbarkeit von Inhalten
Hide followed artists outside Following|Скрывать подписанных художников вне подписок|Gefolgte Künstler außerhalb des Folge-Feeds verbergen
Hide viewed and saved works|Скрывать просмотренные и сохранённые|Angesehene und gespeicherte Werke verbergen
Hide furry content|Скрывать furry-контент|Furry-Inhalte verbergen
Hide AI-generated|Скрывать AI-generated|KI-generierte Werke verbergen
Also hide AI-assisted|Скрывать также AI-assisted|Auch KI-unterstützte Werke verbergen
Show all|Показывать всё|Alle anzeigen
Hidden authors|Скрытые авторы|Verborgene Urheber
Hide creator|Скрыть автора|Urheber verbergen
Show creator|Показать автора|Urheber anzeigen
Unhide|Показать|Anzeigen
Excluded tags|Исключённые теги|Ausgeschlossene Tags
Favorite tags|Избранные теги|Lieblings-Tags
Add to favorites|Добавить в избранное|Zu Favoriten hinzufügen
Remove from favorites|Убрать из избранного|Aus Favoriten entfernen
Hide tag|Скрыть тег|Tag verbergen
Tag actions|Действия с тегом|Tag-Aktionen
Recommendation settings|Настройки рекомендаций|Empfehlungseinstellungen
Settings from liked works|Настройки по понравившимся работам|Einstellungen anhand deiner Likes
Calculating interests…|Считаем интересы…|Vorlieben werden ermittelt…
Default|Обычно|Standard
Priority|Приоритет|Priorität
Exclude|Исключить|Ausschließen
Work curation|Отбор работ|Werkauswahl
Enable work curation|Включить отбор работ|Werkauswahl aktivieren
Popularity within each source|Популярность в своём источнике|Beliebtheit innerhalb der Quelle
Your preferences from likes|Ваши предпочтения по лайкам|Deine Vorlieben anhand der Likes
Publication freshness|Свежесть публикации|Aktualität der Veröffentlichung
Image size|Размер изображения|Bildgröße
Common ranking rules for search, illustrations, recommendations and related works. Votes are compared within their source and rating.|Общие правила отбора для поиска, иллюстраций, рекомендаций и похожих работ. Оценки сравниваются внутри своего источника и рейтинга.|Gemeinsame Auswahlregeln für Suche, Illustrationen, Empfehlungen und ähnliche Werke. Bewertungen werden innerhalb derselben Quelle und Altersfreigabe verglichen.
One JSON file for DART on Windows and Android. Transfer it by any convenient method and import it on the other device.|Один JSON-файл для DART на ПК и Android. Передайте его любым удобным способом и выберите импорт на другом устройстве.|Eine JSON-Datei für DART auf Windows und Android. Übertrage sie auf beliebigem Weg und importiere sie auf dem anderen Gerät.
Likes, bookmarks, follows, viewed works, favorite tags and recommendation priorities are transferred. Import adds to your profile without removing entries. Content filters and curation can be applied separately.|Переносятся лайки, закладки, подписки, просмотренное, избранные теги и приоритеты рекомендаций. Импорт дополняет профиль без удаления существующих записей. Фильтры и отбор можно перенести отдельно.|Likes, Lesezeichen, Abonnements, gesehene Werke, Lieblings-Tags und Empfehlungsvorlieben werden übertragen. Der Import ergänzt das Profil ohne Einträge zu entfernen. Inhaltsfilter und Auswahl können separat übernommen werden.
API keys and source sign-ins stay on their own device. Configure source access on each device.|Ключи API и вход в источники остаются только на своём устройстве. Доступ к источникам настройте на каждом устройстве.|API-Schlüssel und Anmeldungen bleiben auf ihrem Gerät. Richte den Zugriff auf die Quellen auf jedem Gerät ein.
Import profile|Импорт профиля|Profil importieren
Profile exported|Профиль экспортирован|Profil exportiert
Profile imported|Профиль импортирован|Profil importiert
Import completed|Импорт завершён|Import abgeschlossen
Transfer failed|Не удалось перенести профиль|Profil konnte nicht übertragen werden
Cannot read file|Не удалось прочитать файл|Datei konnte nicht gelesen werden
File is too large|Файл слишком большой|Datei ist zu groß
Keep existing settings|Сохранить текущие настройки|Vorhandene Einstellungen behalten
Apply content settings from file|Применить настройки контента из файла|Inhaltseinstellungen aus Datei übernehmen
Data is added without deleting existing entries.|Данные добавляются без удаления существующих.|Daten werden ergänzt, ohne vorhandene Einträge zu löschen.
No API key required|API key не нужен|Kein API-Schlüssel erforderlich
Sign in to Sankaku|Войти в Sankaku|Bei Sankaku anmelden
Sign out of Sankaku|Выйти из Sankaku|Von Sankaku abmelden
Public works available without sign-in|Без авторизации · доступны публичные работы|Ohne Anmeldung sind öffentliche Werke verfügbar
Sankaku username or email|Логин или email Sankaku|Sankaku-Benutzername oder E-Mail
Sankaku password|Пароль Sankaku|Sankaku-Passwort
Enter your Sankaku username and password|Введите логин и пароль Sankaku|Gib deinen Sankaku-Benutzernamen und dein Passwort ein
Signing in to Sankaku…|Авторизация в Sankaku…|Anmeldung bei Sankaku…
Sankaku connected|Sankaku подключён|Sankaku verbunden
Signed out of Sankaku|Вы вышли из Sankaku|Von Sankaku abgemeldet
Connection settings|Настройки подключения|Verbindungseinstellungen
User ID|ID пользователя|Benutzer-ID
Saved|Сохранено|Gespeichert
Connection saved|Подключение сохранено|Verbindung gespeichert
Changes saved|Изменения сохранены|Änderungen gespeichert
Save|Сохранить|Speichern
Apply|Применить|Anwenden
Add|Добавить|Hinzufügen
Remove|Удалить|Entfernen
Done|Готово|Fertig
Close|Закрыть|Schließen
Cancel|Отмена|Abbrechen
Back|Назад|Zurück
More|Ещё|Mehr
Filters|Фильтры|Filter
Rating|Рейтинг|Altersfreigabe
New|Новое|Neu
Source|Источник|Quelle
Artist profile|Профиль художника|Künstlerprofil
Uploader|Загрузчик|Hochladender
Uploader profile|Профиль загрузчика|Profil des Hochladenden
All works by this artist|Все работы автора|Alle Werke dieses Künstlers
Related works|Похожие работы|Ähnliche Werke
Refresh|Обновить|Aktualisieren
Search|Поиск|Suche
Recommendations|Рекомендации|Empfehlungen
Settings|Настройки|Einstellungen
Dark DART|Тёмная DART|Dunkles DART
Open|Открыть|Öffnen
There are no favorite tags yet.|Избранных тегов пока нет.|Noch keine Lieblings-Tags.
Add tags from an artwork or search.|Добавляйте теги из работы или поиска.|Füge Tags aus einem Werk oder der Suche hinzu.
No hidden authors yet. Open an artist profile and choose Hide creator.|Скрытых авторов пока нет. Откройте профиль художника и нажмите «Скрыть автора».|Noch keine verborgenen Urheber. Öffne ein Künstlerprofil und wähle „Urheber verbergen“.
Works by these artists and uploaders are hidden in feeds, history, bookmarks and related works. Entries are kept.|Работы этих художников и загрузчиков скрыты в лентах, истории, закладках и похожем. Записи не удаляются.|Werke dieser Künstler und Hochladenden werden in Feeds, Verlauf, Lesezeichen und ähnlichen Werken verborgen. Einträge bleiben erhalten.
`;
const aliases=new Set(rows.flat());for(const line of native.trim().split('\n')){const row=line.split('|');if(row.length!==3)throw Error('Invalid native row');
  // The native Russian spelling may differ; keep the shared English message's existing translation.
  const common=rows.find(old=>old[0]===row[0]);if(common&&common[1]!==row[1])row[2]=common[2];
  if(!aliases.has(row[1])){rows.push(row);for(const value of row)aliases.add(value);}}
// Keep previously bundled mobile aliases explicit so regeneration never drops them.
// These include complete multiline messages and count prefixes used by native views.
const nativeAliases=[
  ["Got it","Понятно","Verstanden"],
  ["Find illustrations","Найти иллюстрации","Illustrationen finden"],
  ["Popular","Популярное","Beliebt"],
  ["All new works","Все новые","Alle neuen Werke"],
  ["All sources","Все источники","Alle Quellen"],
  ["Popular in your feed","Популярные в ленте","Beliebt in deinem Feed"],
  ["The source repeated a page. Tap to retry.","Источник повторил страницу. Нажмите для повторной загрузки.","Die Quelle hat eine Seite wiederholt. Tippe zum erneuten Laden."],
  ["Could not load the catalog. Tap to retry.","Не удалось загрузить каталог. Нажмите, чтобы повторить.","Der Katalog konnte nicht geladen werden. Tippe zum Wiederholen."],
  ["No works match these filters. Change your settings.","Нет работ для этих фильтров. Измените настройки.","Keine Werke entsprechen diesen Filtern. Ändere deine Einstellungen."],
  ["Illustrations from your sources","Иллюстрации из ваших источников","Illustrationen aus deinen Quellen"],
  ["Preparing the next illustrations…","Подготовка следующих иллюстраций…","Die nächsten Illustrationen werden vorbereitet…"],
  ["Looking for available works…","Ищем доступные работы…","Verfügbare Werke werden gesucht…"],
  ["Load more","Загрузить ещё","Mehr laden"],
  ["Follow an artist to see their new works.","Подпишитесь на художника, чтобы видеть его новые работы.","Folge einem Künstler, um seine neuen Werke zu sehen."],
  ["Selection viewed · tap to refresh recommendations","Подборка просмотрена · нажмите, чтобы обновить рекомендации","Auswahl angesehen · tippe für neue Empfehlungen"],
  ["No new results yet · tap to refresh","Пока новых результатов нет · нажмите, чтобы обновить","Noch keine neuen Ergebnisse · tippe zum Aktualisieren"],
  ["Sign in to Sankaku","Авторизуйтесь в Sankaku","Bei Sankaku anmelden"],
  ["Sankaku access is restricted","Доступ Sankaku ограничен","Der Zugriff auf Sankaku ist eingeschränkt"],
  ["Sign in","Авторизоваться","Anmelden"],
  ["Open Sankaku","Открыть Sankaku","Sankaku öffnen"],
  ["Search illustrations by tags","Поиск иллюстраций по тегам","Illustrationen nach Tags suchen"],
  ["Search","Искать","Suchen"],
  ["Search query is too long","Запрос слишком длинный","Die Suchanfrage ist zu lang"],
  ["Landscapes","Пейзажи","Landschaften"],
  ["Original works","Оригинальное","Originalwerke"],
  ["Sky","Небо","Himmel"],
  ["Animals","Животные","Tiere"],
  ["Portraits","Портреты","Porträts"],
  ["Fantasy","Фэнтези","Fantasy"],
  ["Cities","Города","Städte"],
  ["Flowers","Цветы","Blumen"],
  ["Pixel art","Пиксель-арт","Pixel-Art"],
  ["Space","Космос","Weltraum"],
  ["Sea","Море","Meer"],
  ["Nature","Природа","Natur"],
  ["Illustrations from the catalog","Иллюстрации из каталога","Illustrationen aus dem Katalog"],
  ["My page","Моя страница","Meine Seite"],
  ["Your catalog on your phone","Ваш каталог на телефоне","Dein Katalog auf dem Smartphone"],
  ["Import profile from PC","Импорт профиля с ПК","Profil vom PC importieren"],
  ["Sankaku sign-in status","Статус авторизации Sankaku","Sankaku-Anmeldestatus"],
  ["Sign in to Sankaku to access restricted works. Popular works follow the site's ordering. Some features and works may require Plus.","Для ограниченных работ авторизуйтесь в Sankaku. Популярные загружаются в порядке сайта. Отдельные функции и работы могут требовать подписку Plus.","Melde dich bei Sankaku an, um eingeschränkte Werke zu öffnen. Beliebte Werke folgen der Reihenfolge der Website. Manche Funktionen und Werke erfordern Plus."],
  ["Sankaku login","Логин Sankaku","Sankaku-Anmeldename"],
  ["Sankaku did not respond. Please sign in again.","Sankaku не ответил. Повторите вход.","Sankaku hat nicht geantwortet. Bitte melde dich erneut an."],
  ["Could not save the sign-in. Please sign in again.","Не удалось сохранить вход. Повторите авторизацию.","Die Anmeldung konnte nicht gespeichert werden. Bitte melde dich erneut an."],
  ["Could not sign in to Sankaku","Не удалось войти в Sankaku","Anmeldung bei Sankaku fehlgeschlagen"],
  ["Signed out · public works are available","Вы вышли · доступны публичные работы","Abgemeldet · öffentliche Werke sind verfügbar"],
  ["Your password is sent only to Sankaku over HTTPS and is not saved. Sign-in tokens are encrypted with Android Keystore and excluded from profile exports.","Пароль отправляется по HTTPS только в Sankaku и не сохраняется. Токены входа зашифрованы Android Keystore и не входят в экспорт профиля.","Dein Passwort wird ausschließlich über HTTPS an Sankaku gesendet und nicht gespeichert. Anmeldetokens werden mit Android Keystore verschlüsselt und nicht exportiert."],
  ["Open Sankaku website","Открыть сайт Sankaku","Sankaku-Website öffnen"],
  ["Normal tag","Обычный тег","Normaler Tag"],
  ["Priority tag","Приоритетный тег","Bevorzugter Tag"],
  ["Exclude from recommendations","Не показывать в рекомендациях","Nicht in Empfehlungen anzeigen"],
  ["Show tag","Показывать тег","Tag anzeigen"],
  ["Search tag","Искать тег","Nach Tag suchen"],
  ["Select for a combined search","Выбрать для поиска с другими тегами","Für eine Suche mit anderen Tags auswählen"],
  ["Yellow tags have priority; red tags are excluded from recommendations. Tap a tag to change it. Likes and bookmarks are stored separately.","Жёлтый тег получает приоритет, красный исключается из рекомендаций. Нажмите на тег, чтобы изменить его. Лайки и закладки хранятся отдельно.","Gelbe Tags werden bevorzugt, rote aus Empfehlungen ausgeschlossen. Tippe auf einen Tag, um ihn zu ändern. Likes und Lesezeichen werden getrennt gespeichert."],
  ["Like a few illustrations to see your interests here. Until then, Home shows the general feed.","Отметьте несколько иллюстраций сердцем, и здесь появятся ваши интересы. До этого главная показывает общую ленту.","Markiere einige Illustrationen mit einem Herz, um hier deine Interessen zu sehen. Bis dahin zeigt die Startseite den allgemeinen Feed."],
  ["Interface language. Artist names, artwork titles and tags are not translated.","Язык интерфейса. Имена художников, названия работ и теги остаются без перевода.","Sprache der Oberfläche. Künstlernamen, Werktitel und Tags werden nicht übersetzt."],
  ["Choose a theme for the whole app. System mode follows your phone's settings.","Выберите оформление для всего приложения. Системный режим следует настройке телефона.","Wähle ein Design für die ganze App. Der Systemmodus folgt den Einstellungen deines Smartphones."],
  ["Follow system","Как в системе","Systemeinstellung"],
  ["Apply theme","Применить тему","Design anwenden"],
  ["Privacy","Приватность","Datenschutz"],
  ["Screen protection","Защита экрана","Bildschirmschutz"],
  ["Hide the app in screenshots","Скрывать приложение на снимках экрана","App in Bildschirmaufnahmen ausblenden"],
  ["Android blocks screenshots and recordings of the app window while this switch is enabled. Content remains visible on the phone itself.","Android блокирует снимки и запись окна приложения, пока переключатель включён. Содержимое остаётся видно на самом телефоне.","Android blockiert Bildschirmfotos und Aufnahmen des App-Fensters, solange diese Option aktiviert ist. Auf dem Smartphone selbst bleibt der Inhalt sichtbar."],
  ["Content filters","Фильтры содержимого","Inhaltsfilter"],
  ["Configure recommendations","Настроить рекомендации","Empfehlungen einstellen"],
  ["Profile transfer · PC ↔ Android","Перенос профиля · ПК ↔ Android","Profilübertragung · PC ↔ Android"],
  ["Uses AI-generated, AI-art, Stable Diffusion, NovelAI and AI-assisted tags. Untagged works are not automatically classified as AI.","Учитываются метки AI-generated, AI-art, Stable Diffusion, NovelAI и AI-assisted. Работы без этих тегов не определяются автоматически как AI.","Berücksichtigt AI-generated, AI-art, Stable Diffusion, NovelAI und AI-assisted. Werke ohne diese Tags werden nicht automatisch als KI-Inhalte eingestuft."],
  ["Hides works from search, recommendations and related works, including copies with the same MD5. Bookmarks, history and artist profiles stay available.","Скрывает работы из поиска, рекомендаций и похожих, включая копии с тем же MD5. Закладки, история и профили авторов остаются доступны.","Blendet Werke aus Suche, Empfehlungen und ähnlichen Werken aus, einschließlich Kopien mit derselben MD5. Lesezeichen, Verlauf und Künstlerprofile bleiben verfügbar."],
  ["Hide followed artists outside Following","Скрывать подписанных авторов вне Following","Gefolgte Künstler außerhalb von Following ausblenden"],
  ["Only affects search, illustrations, recommendations and related works. Following, likes, bookmarks, history and profiles remain available.","Только в поиске, иллюстрациях, рекомендациях и похожих работах. Подписки, лайки, закладки, история и профили сохраняются.","Betrifft nur Suche, Illustrationen, Empfehlungen und ähnliche Werke. Following, Likes, Lesezeichen, Verlauf und Profile bleiben verfügbar."],
  ["Enter tags separated by commas. Matching is exact: latex does not exclude latex_gloves.","Можно указать несколько тегов через запятую. Совпадение точное: latex не исключает latex_gloves.","Trenne mehrere Tags durch Kommas. Der Abgleich ist exakt: latex schließt latex_gloves nicht aus."],
  ["Save filters","Сохранить фильтры","Filter speichern"],
  ["Hide furry and anthro","Скрывать furry и anthro","Furry und Anthro ausblenden"],
  ["Only explicit furry and anthro tags are used, including grouped copies. Ears, tails and fur clothing alone are not hidden.","Учитываются только явные теги furry и anthro, в том числе у объединённых копий. Уши, хвосты и одежда с мехом сами по себе не скрываются.","Berücksichtigt nur ausdrückliche Furry- und Anthro-Tags, auch bei zusammengeführten Kopien. Ohren, Schwänze und Fellkleidung allein werden nicht ausgeblendet."],
  ["Primary attribution","Основная подпись автора","Vorrangige Urheberangabe"],
  ["The artist, original publication and uploader are shown separately in the artwork. Choose the primary attribution here.","Художник, исходная публикация и загрузчик показаны отдельно в работе. Здесь выбирается основная подпись.","Künstler, Originalveröffentlichung und Uploader werden beim Werk getrennt angezeigt. Wähle hier die vorrangige Angabe."],
  ["Following uses the artist's tag. The original link opens the publication; the uploader may be a different person.","Подписка создаётся на тег художника. Исходная ссылка открывает публикацию; загрузчик может быть другим человеком.","Du folgst dem Künstler-Tag. Der Originallink öffnet die Veröffentlichung; der Uploader kann eine andere Person sein."],
  ["Save attribution preference","Сохранить приоритет","Vorrangige Angabe speichern"],
  ["Opening illustrations","Открытие иллюстраций","Illustrationen öffnen"],
  ["One temporary preview","Один временный просмотр","Eine temporäre Vorschau"],
  ["The temporary work is replaced by the next one. Open works are available from the viewer or My page. Pin a work with the star to keep it open; pinned works are not replaced or closed.","Временная работа заменяется следующей. Открытые работы доступны через кнопку в просмотре или на моей странице. Закрепите работу звёздочкой, чтобы сохранить её среди открытых; закреплённая работа не заменяется и не закрывается.","Das temporäre Werk wird durch das nächste ersetzt. Offene Werke findest du im Betrachter oder auf Meine Seite. Fixiere ein Werk mit dem Stern, um es offen zu halten; fixierte Werke werden nicht ersetzt oder geschlossen."],
  ["Save mode","Сохранить режим","Modus speichern"],
  ["Mode saved","Режим сохранён","Modus gespeichert"],
  ["Search works on this phone without a running PC. API keys are stored in Android Keystore and excluded from exports.","Поиск работает на этом телефоне без включённого ПК. API-ключи хранятся в Android Keystore и не попадают в экспорт.","Die Suche läuft auf diesem Smartphone ohne eingeschalteten PC. API-Schlüssel werden mit Android Keystore gespeichert und nicht exportiert."],
  ["Public search is available without an API key.","Публичный поиск доступен без API key.","Die öffentliche Suche ist ohne API-Schlüssel verfügbar."],
  ["Source connected","Источник подключён","Quelle verbunden"],
  ["Source not connected","Источник не подключён","Quelle nicht verbunden"],
  ["API key · leave empty to keep the current key","API key · оставить пустым для сохранения текущего","API-Schlüssel · leer lassen, um den bisherigen zu behalten"],
  ["Could not read the connection. Existing keys have been kept.","Не удалось прочитать подключение. Существующие ключи сохранены.","Die Verbindung konnte nicht gelesen werden. Vorhandene Schlüssel wurden behalten."],
  ["An empty API key keeps the current key. Clear User ID and save to disconnect the source.","Пустой API key сохраняет существующий ключ. Очистите User ID и сохраните, чтобы отключить источник.","Ein leeres API-Schlüsselfeld behält den bisherigen Schlüssel. Leere die User ID und speichere, um die Quelle zu trennen."],
  ["Wait for connection settings to load","Подождите загрузки настроек подключения","Warte, bis die Verbindungseinstellungen geladen sind"],
  ["Check User ID and API key","Проверьте User ID и API key","Prüfe User ID und API-Schlüssel"],
  ["Enter an API key for the first connection","Введите API key для первого подключения","Gib für die erste Verbindung einen API-Schlüssel ein"],
  ["Source disconnected","Источник отключён","Quelle getrennt"],
  ["Source settings saved","Настройки источника сохранены","Quelleneinstellungen gespeichert"],
  ["Could not save the keys","Не удалось сохранить ключи","Schlüssel konnten nicht gespeichert werden"],
  ["This work is hidden by content filters","Эта работа скрыта фильтрами содержимого","Dieses Werk wird durch Inhaltsfilter ausgeblendet"],
  ["Open image fullscreen","Открыть изображение на весь экран","Bild im Vollbild öffnen"],
  ["Share","Поделиться","Teilen"],
  ["Open source","Открыть источник","Quelle öffnen"],
  ["▣ Saved","▣ Сохранено","▣ Gespeichert"],
  ["▣ Bookmark","▣ Закладка","▣ Lesezeichen"],
  ["♥ Liked","♥ Нравится","♥ Gefällt mir"],
  ["♡ Like","♡ Нравится","♡ Gefällt mir"],
  ["Search selected tags","Искать выбранные теги","Nach ausgewählten Tags suchen"],
  ["Related illustrations","Похожие иллюстрации","Ähnliche Illustrationen"],
  ["Could not refresh the Sankaku work. Open it again to retry.","Не удалось обновить работу Sankaku. Повторите открытие.","Das Sankaku-Werk konnte nicht aktualisiert werden. Öffne es zum Wiederholen erneut."],
  ["Error · retry →","Ошибка · повторить →","Fehler · erneut versuchen →"],
  ["Loading error · retry →","Ошибка загрузки · повторить →","Ladefehler · erneut versuchen →"],
  ["Could not load more. Tap right to retry.","Не удалось загрузить продолжение. Нажмите вправо, чтобы повторить.","Weitere Werke konnten nicht geladen werden. Tippe rechts, um es erneut zu versuchen."],
  ["Preparing the next illustration","Подготовка следующей иллюстрации","Nächste Illustration wird vorbereitet"],
  ["Image error · retry →","Ошибка изображения · повторить →","Bildfehler · erneut versuchen →"],
  ["Could not prepare the image. Swipe again to retry.","Не удалось подготовить изображение. Повторите перелистывание.","Das Bild konnte nicht vorbereitet werden. Wische erneut, um es zu versuchen."],
  ["Artist · open profile","Художник · открыть профиль","Künstler · Profil öffnen"],
  ["Original publication","Исходная публикация","Originalveröffentlichung"],
  ["This work has no uploader name","У этой работы нет имени загрузчика","Für dieses Werk ist kein Uploadername angegeben"],
  ["SFW works","Обычные работы","SFW-Werke"],
  ["NSFW works","Работы 18+","NSFW-Werke"],
  ["All ratings","Все рейтинги","Alle Inhaltsbewertungen"],
  ["Show artist","Показывать автора","Künstler anzeigen"],
  ["Uploader profile unavailable","Профиль загрузчика недоступен","Uploaderprofil nicht verfügbar"],
  ["Show uploader","Показывать загрузчика","Uploader anzeigen"],
  ["Hide uploader","Скрыть загрузчика","Uploader ausblenden"],
  ["Find an open work","Найти открытую работу","Offenes Werk finden"],
  ["Checking Sankaku access…","Проверка доступа Sankaku…","Sankaku-Zugriff wird geprüft…"],
  ["Could not load the Sankaku work. Try again later.","Не удалось загрузить работу Sankaku. Повторите позже.","Das Sankaku-Werk konnte nicht geladen werden. Versuche es später erneut."],
  ["Close preview","Закрыть просмотр","Vorschau schließen"],
  ["Video unavailable","Видео недоступно","Video nicht verfügbar"],
  ["This device does not support this video format","Этот формат видео не поддерживается устройством","Dieses Gerät unterstützt das Videoformat nicht"],
  ["Close video","Закрыть видео","Video schließen"],
  ["Could not read the profile","Не удалось прочитать профиль","Das Profil konnte nicht gelesen werden"],
  ["Records are added to your profile. Repeated imports do not create copies. Likes and bookmarks stay separate. API keys are not transferred.","Записи добавятся к вашему профилю. Повторный импорт не создаёт копии. Лайки и закладки остаются отдельными. Ключи API не переносятся.","Einträge werden zu deinem Profil hinzugefügt. Wiederholte Importe erzeugen keine Kopien. Likes und Lesezeichen bleiben getrennt. API-Schlüssel werden nicht übertragen."],
  ["Also transfer filter and curation settings","Перенести также настройки фильтров и отбора","Filter- und Auswahleinstellungen ebenfalls übertragen"],
  ["Import DART profile","Импорт профиля DART","DART-Profil importieren"],
  ["Merge","Объединить","Zusammenführen"],
  ["Profiles merged","Профили объединены","Profile zusammengeführt"],
  ["Import failed","Импорт не выполнен","Import fehlgeschlagen"],
  ["Please try again.","Попробуйте ещё раз.","Bitte versuche es erneut."],
  ["Share illustration","Поделиться иллюстрацией","Illustration teilen"],
  ["Unsupported link","Неподдерживаемая ссылка","Nicht unterstützter Link"],
  ["No browser is installed on this device","На устройстве не установлен браузер","Auf diesem Gerät ist kein Browser installiert"],
  ["Original unavailable","Оригинал недоступен","Original nicht verfügbar"],
  ["Original saved","Оригинал сохранён","Original gespeichert"],
  ["Action failed","Действие не выполнено","Aktion fehlgeschlagen"],
  ["Could not complete the action. Your profile is safe; check the file and try again.","Не удалось выполнить действие. Профиль сохранён; проверьте файл и попробуйте ещё раз.","Die Aktion konnte nicht abgeschlossen werden. Dein Profil wurde behalten; prüfe die Datei und versuche es erneut."],
  ["\nTap to retry.","\nНажмите, чтобы повторить.","\nTippe zum Wiederholen."],
  ["Bookmarks will appear here.\nSave a work using the button inside its illustration.","Закладки появятся здесь.\nСохраните работу кнопкой внутри иллюстрации.","Hier erscheinen deine Lesezeichen.\nSpeichere ein Werk mit der Schaltfläche in seiner Ansicht."],
  ["No works here yet.\nChange filters or tap to refresh.","Здесь пока нет работ.\nИзмените фильтры или нажмите, чтобы обновить.","Hier sind noch keine Werke.\nÄndere die Filter oder tippe zum Aktualisieren."],
  ["\nTap to sign in.","\nНажмите, чтобы авторизоваться.","\nTippe zum Anmelden."],
  ["Find ","Найти ","Finden: "],
  ["Find your inspiration\n","Найдите своё вдохновение\n","Finde deine Inspiration\n"],
  ["Topic ","Тема ","Thema "],
  ["Open illustration ","Открыть иллюстрацию ","Illustration öffnen: "],
  [" · New"," · Новое"," · Neu"],
  [" liked · "," нравится · "," Likes · "],
  [" bookmarks"," закладок"," Lesezeichen"],
  [" followed artists"," подписок"," gefolgte Künstler"],
  ["\nData is stored on this phone","\nДанные хранятся на этом телефоне","\nDaten werden auf diesem Smartphone gespeichert"],
  ["Open an illustration and follow its artist.\nYou can also add an artist tag here.","Откройте иллюстрацию и подпишитесь на художника.\nЗдесь можно добавить его тег вручную.","Öffne eine Illustration und folge ihrem Künstler.\nHier kannst du auch einen Künstler-Tag hinzufügen."],
  [" · API key required"," · нужен API key"," · API-Schlüssel erforderlich"],
  ["Saved sign-in: ","Вход сохранён: ","Gespeicherte Anmeldung: "],
  ["Signed in: ","Вход выполнен: ","Angemeldet: "],
  ["Save ","Сохранить ","Speichern: "],
  ["Open website ","Открыть сайт ","Website öffnen: "],
  ["Image 1 of ","Изображение 1 из ","Bild 1 von "],
  [". Open fullscreen",". Открыть на весь экран",". Im Vollbild öffnen"],
  ["More ","Ещё ","Weitere "],
  [" tags"," тегов"," Tags"],
  ["Search selected · ","Искать выбранные · ","Ausgewählte suchen · "],
  ["Image ","Изображение ","Bild "],
  [" of "," из "," von "],
  ["Original publication · ","Исходная публикация · ","Originalveröffentlichung · "],
  ["Uploader · ","Загрузчик · ","Uploader · "],
  ["Artist profile ","Профиль художника ","Künstlerprofil "],
  ["Artist · ","Художник · ","Künstler · "],
  ["\nAcross all connected sources","\nВо всех подключённых источниках","\nIn allen verbundenen Quellen"],
  ["\nWorks from this source","\nРаботы из этого источника","\nWerke aus dieser Quelle"],
  ["Illustration #","Иллюстрация #","Illustration #"],
  [" · image "," · изображение "," · Bild "],
  [". Swipe to browse works, double-tap to like, pinch to zoom.",". Свайп листает работы, двойное нажатие ставит лайк, два пальца масштабируют.",". Wische zum Blättern, tippe doppelt für ein Like und zoome mit zwei Fingern."],
  ["Likes: ","Лайки: ","Likes: "],
  ["\nBookmarks: ","\nЗакладки: ","\nLesezeichen: "],
  ["\nFollowing: ","\nПодписки: ","\nGefolgte Künstler: "],
  ["\nViewed: ","\nПросмотренное: ","\nGesehen: "],
  ["\nHistory: ","\nИстория: ","\nVerlauf: "],
  ["\nFavorite tags: ","\nИзбранные теги: ","\nLieblings-Tags: "],
  ["\n\nExisting entries have been kept. A local backup was created before importing.","\n\nСуществующие записи сохранены. Перед импортом создана локальная резервная копия.","\n\nVorhandene Einträge wurden behalten. Vor dem Import wurde eine lokale Sicherung erstellt."],
  ["Your existing profile is safe. ","Существующий профиль сохранён. ","Dein vorhandenes Profil wurde behalten. "],
  ["All entries are already in this profile. No changes were made.","Все записи уже есть в профиле. Изменений нет.","Alle Eintraege sind bereits in diesem Profil. Keine Aenderungen."],
  ["Existing entries were kept.","Существующие записи сохранены.","Vorhandene Eintraege bleiben erhalten."],
];
const settingsMessages=[
  ["About DART","О DART","Über DART"],
  ["Version and updates","Версия и обновления","Version und Updates"],
  ["Manage your content, connections and app preferences.","Управляйте контентом, подключениями и настройками приложения.","Verwalte Inhalte, Verbindungen und App-Einstellungen."],
  ["Public search · no key required","Публичный поиск · ключ не требуется","Öffentliche Suche · kein Schlüssel erforderlich"],
  ["Signed in","Вход выполнен","Angemeldet"],
  ["Public access · sign in for more","Публичный доступ · войдите, чтобы видеть больше","Öffentlicher Zugriff · anmelden für mehr Inhalte"],
  ["Version","Версия","Version"],
  ["Install Android updates over the existing app to keep your profile.","Устанавливайте обновления Android поверх приложения, чтобы сохранить профиль.","Installiere Android-Updates über die vorhandene App, damit dein Profil erhalten bleibt."],
  ["View Android releases","Релизы для Android","Android-Versionen ansehen"],
  ["Discover Art","Discover Art","Discover Art"],
  ["Choose which AI-tagged works appear in your feeds.","Выберите, какие работы с AI-тегами показывать в лентах.","Wähle, welche Werke mit KI-Tags in deinen Feeds erscheinen."],
  ["Works tagged as generated by AI.","Работы с тегами генерации с помощью AI.","Werke, die als KI-generiert markiert sind."],
  ["Also hide works made with AI assistance.","Также скрывать работы, созданные при участии AI.","Auch Werke ausblenden, die mit KI-Unterstützung entstanden sind."],
  ["Use the factors below across your feeds.","Применять указанные ниже факторы ко всем лентам.","Die folgenden Faktoren auf alle Feeds anwenden."],
  ["Favorite topics and recommendation priorities","Любимые темы и приоритеты рекомендаций","Lieblingsthemen und Prioritäten für Empfehlungen"],
  ["Manage creators hidden from your feeds","Управление авторами, скрытыми из лент","In deinen Feeds verborgene Urheber verwalten"],
  ["API key","Ключ API","API-Schlüssel"],
];
const exactRows=new Set(rows.map(row=>JSON.stringify(row)));
for(const row of [...nativeAliases,...settingsMessages]){
  const key=JSON.stringify(row);if(exactRows.has(key))continue;
  rows.push(row);exactRows.add(key);
}
const output=path.join(__dirname,'../main/assets/dart-messages.json');fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(rows,null,2)+'\n');
console.log(`Wrote ${rows.length} exact UI messages; desktop common translations retained.`);
