package com.artcatalog.mobile;

import org.json.*;
import org.junit.Test;
import java.nio.file.*;
import static org.junit.Assert.*;

public class I18nTest {
    private JSONArray messages() throws Exception {Path p=Path.of("src/main/assets/dart-messages.json");if(!Files.exists(p))p=Path.of("app/src/main/assets/dart-messages.json");return new JSONArray(new String(Files.readAllBytes(p),java.nio.charset.StandardCharsets.UTF_8));}
    @Test public void englishDefaultAndAllThreeExactAliasesWork() throws Exception {
        I18n english=new I18n(null,messages()),german=new I18n("de",messages()),russian=new I18n("ru",messages());
        assertEquals("en",english.language);assertEquals("Home",english.text("Главная"));assertEquals("Startseite",german.text("Главная"));assertEquals("Главная",russian.text("Home"));
        assertEquals("Profile transfer",english.text("Перенос профиля"));assertEquals("Profilübertragung",german.text("Перенос профиля"));assertEquals("Curation",english.text("Отбор"));
    }
    @Test public void catalogAndUserDataAreNeverSubstringTranslated() throws Exception {
        I18n german=new I18n("de",messages());for(String value:new String[]{"alice_(sample)","Home by Alice","landscape","#forest","portrait:blue","Главная улица","My Home illustration"," Home "})assertEquals(value,german.text(value));
        assertEquals("",german.text(null));assertEquals("",german.text(""));
    }
    @Test public void unsupportedPreferenceUsesEnglishWithoutReadingSystemLocale(){assertEquals("en",I18n.normalizeLanguage("fr"));assertEquals("en",I18n.normalizeLanguage(null));assertEquals("ru",I18n.normalizeLanguage("ru"));}
    @Test public void nativeSettingsTransferAndMediaStatesHaveEnglishAndGermanLabels() throws Exception {
        I18n english=new I18n("en",messages()),german=new I18n("de",messages());
        String[][] cases={
            {"Перенос профиля · ПК ↔ Android","Profile transfer · PC ↔ Android","Profilübertragung · PC ↔ Android"},
            {"Скрывать подписанных авторов вне Following","Hide followed artists outside Following","Gefolgte Künstler außerhalb von Following ausblenden"},
            {"Перенести также настройки фильтров и отбора","Also transfer filter and curation settings","Filter- und Auswahleinstellungen ebenfalls übertragen"},
            {"Импорт профиля DART","Import DART profile","DART-Profil importieren"},
            {"Объединить","Merge","Zusammenführen"},
            {"Профили объединены","Profiles merged","Profile zusammengeführt"},
            {"Импорт не выполнен","Import failed","Import fehlgeschlagen"},
            {"Подготовка следующих иллюстраций…","Preparing the next illustrations…","Die nächsten Illustrationen werden vorbereitet…"},
            {"Этот формат видео не поддерживается устройством","This device does not support this video format","Dieses Gerät unterstützt das Videoformat nicht"},
            {"Сохранить фильтры","Save filters","Filter speichern"},
            {"Применить тему","Apply theme","Design anwenden"},
            {"Поиск работает на этом телефоне без включённого ПК. API-ключи хранятся в Android Keystore и не попадают в экспорт.","Search works on this phone without a running PC. API keys are stored in Android Keystore and excluded from exports.","Die Suche läuft auf diesem Smartphone ohne eingeschalteten PC. API-Schlüssel werden mit Android Keystore gespeichert und nicht exportiert."}
        };
        for(String[] row:cases){assertEquals(row[0],row[1],english.text(row[0]));assertEquals(row[0],row[2],german.text(row[0]));}
    }
    @Test public void exactMultilineAndCountPrefixesTranslateWithoutTranslatingCatalogValues() throws Exception {
        I18n english=new I18n("en",messages()),german=new I18n("de",messages());
        assertEquals("Bookmarks will appear here.\nSave a work using the button inside its illustration.",english.text("Закладки появятся здесь.\nСохраните работу кнопкой внутри иллюстрации."));
        assertEquals("\nLesezeichen: ",german.text("\nЗакладки: "));
        assertEquals("\nViewed: ",english.text("\nПросмотренное: "));
        for(String value:new String[]{"alice_(sample)","landscape/sample:blue","My Home illustration","Artist · Alice","Существующий профиль сохранён. user-data"})assertEquals(value,german.text(value));
    }
    @Test public void everyMessageHasThreeNonemptyLanguageValues() throws Exception {
        JSONArray rows=messages();assertTrue("Desktop and native UI messages are bundled",rows.length()>800);
        for(int i=0;i<rows.length();i++){JSONArray row=rows.getJSONArray(i);assertEquals(3,row.length());for(int language=0;language<3;language++)assertFalse("Empty message at "+i+":"+language,row.getString(language).isBlank());}
    }

}
