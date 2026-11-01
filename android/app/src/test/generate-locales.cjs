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
const output=path.join(__dirname,'../main/assets/dart-messages.json');fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(rows,null,2)+'\n');
console.log(`Wrote ${rows.length} exact UI messages; desktop common translations retained.`);
