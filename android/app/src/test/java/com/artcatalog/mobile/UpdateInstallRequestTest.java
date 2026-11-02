package com.artcatalog.mobile;

import org.junit.Test;
import static org.junit.Assert.*;

public class UpdateInstallRequestTest {
    @Test public void permissionReturnRequiresAUserRequestAndCanBeConsumedOnlyOnce(){UpdateInstallRequest request=new UpdateInstallRequest();assertFalse(request.finish(true,true));request.begin();assertTrue(request.pending());assertTrue(request.finish(true,true));assertFalse(request.finish(true,true));}
    @Test public void denialOrUnavailableApkClearsTheRequestWithoutPromptingAgain(){UpdateInstallRequest request=new UpdateInstallRequest();request.begin();assertFalse(request.finish(false,true));assertFalse(request.pending());assertFalse(request.finish(true,true));request.begin();assertFalse(request.finish(true,false));}
    @Test public void recreationPreservesOnlyAnExplicitPendingRequestAndCancellationRevokesIt(){UpdateInstallRequest request=new UpdateInstallRequest();request.restore(true);assertTrue(request.pending());request.cancel();assertFalse(request.pending());assertFalse(request.finish(true,true));request.restore(false);assertFalse(request.pending());}
}
