package com.dayflow.app;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(android.os.Bundle savedInstanceState) {
        registerPlugin(NotificationSetupPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
