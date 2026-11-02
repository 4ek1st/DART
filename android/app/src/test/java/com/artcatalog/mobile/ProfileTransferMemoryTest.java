package com.artcatalog.mobile;

import org.json.*;
import org.junit.Test;
import java.io.*;
import java.lang.reflect.*;
import java.nio.charset.StandardCharsets;
import static org.junit.Assert.*;

/** Large profile operations must not materialize an extra whole-document JSON string. */
public class ProfileTransferMemoryTest {
    private static final class NoStringObject extends JSONObject {
        @Override public String toString(){throw new AssertionError("A full JSON object was serialized just to copy or save it");}
    }
    private static final class NoStringArray extends JSONArray {
        @Override public String toString(){throw new AssertionError("A full JSON array was serialized just to copy or save it");}
    }
    private Object call(String name,Class<?>[] parameters,Object...args) throws Exception {
        Method method;try{method=ProfileTransfer.class.getDeclaredMethod(name,parameters);}catch(NoSuchMethodException missing){throw new AssertionError("Missing bounded-memory profile operation: "+name,missing);}
        method.setAccessible(true);try{return method.invoke(null,args);}catch(InvocationTargetException wrapped){Throwable error=wrapped.getCause();if(error instanceof Error)throw (Error)error;if(error instanceof Exception)throw (Exception)error;throw wrapped;}
    }
    @Test public void copyingContainersDoesNotSerializeThemAndKeepsNestedValuesIndependent() throws Exception {
        JSONObject nested=new NoStringObject().put("value","neutral"),source=new NoStringObject().put("records",new NoStringArray().put(nested)).put("count",3).put("nothing",JSONObject.NULL);
        JSONObject copied=(JSONObject)call("copy",new Class<?>[]{JSONObject.class},source);
        assertNotSame(source,copied);assertNotSame(source.getJSONArray("records"),copied.getJSONArray("records"));
        copied.getJSONArray("records").getJSONObject(0).put("value","updated");assertEquals("neutral",nested.getString("value"));assertEquals(3,copied.getInt("count"));assertTrue(copied.isNull("nothing"));
    }
    @Test public void streamingPreservesUnicodeEscapesNumbersAndDoesNotCloseTheAtomicFile() throws Exception {
        String text="quote\" backslash\\ newline\n control\u0001 emoji\uD83C\uDFA8 Deutsch ä Русский";
        JSONObject source=new NoStringObject().put("text",text).put("array",new NoStringArray().put(true).put(JSONObject.NULL).put(-17).put(1.25));
        TrackingOutput output=new TrackingOutput();call("writeJson",new Class<?>[]{JSONObject.class,OutputStream.class},source,output);
        assertFalse("AtomicFile owns the stream commit/close",output.closed);JSONObject parsed=new JSONObject(output.toString(StandardCharsets.UTF_8));assertEquals(text,parsed.getString("text"));assertTrue(parsed.getJSONArray("array").getBoolean(0));assertTrue(parsed.getJSONArray("array").isNull(1));assertEquals(-17,parsed.getJSONArray("array").getInt(2));assertEquals(1.25,parsed.getJSONArray("array").getDouble(3),0);
    }
    @Test public void aLargeProfileIsWrittenInBoundedChunks() throws Exception {
        JSONArray records=new NoStringArray();String tag="neutral ".repeat(64);for(int i=0;i<3000;i++)records.put(new NoStringObject().put("value",tag).put("index",i));
        TrackingOutput output=new TrackingOutput();call("writeJson",new Class<?>[]{JSONObject.class,OutputStream.class},new NoStringObject().put("records",records),output);
        assertTrue(output.size()>1024*1024);assertTrue("Writing must not allocate a document-sized byte array",output.largestChunk<=32768);assertEquals(3000,new JSONObject(output.toString(StandardCharsets.UTF_8)).getJSONArray("records").length());
    }
    @Test public void countingUsesExactUtf8BytesBeforeOpeningAnExportDestination() throws Exception {
        JSONObject value=new JSONObject().put("text","ä Русский \uD83C\uDFA8\n\"").put("nested",new JSONArray().put(1.25).put(false));
        int expected=value.toString().getBytes(StandardCharsets.UTF_8).length;
        assertEquals(expected,call("encodedBytes",new Class<?>[]{JSONObject.class,int.class},value,expected));
    }
    @Test public void oversizedExportIsRejectedWithoutBuildingItsJsonStringOrWritingAFile() throws Exception {
        JSONObject value=new NoStringObject().put("records",new NoStringArray().put("neutral".repeat(1000)));
        try{call("encodedBytes",new Class<?>[]{JSONObject.class,int.class},value,128);fail("An oversized export was accepted");}catch(IOException expected){}
    }
    private static final class TrackingOutput extends ByteArrayOutputStream {
        boolean closed;int largestChunk;
        @Override public synchronized void write(byte[] bytes,int offset,int length){largestChunk=Math.max(largestChunk,length);super.write(bytes,offset,length);}
        @Override public void close(){closed=true;}
    }
}
