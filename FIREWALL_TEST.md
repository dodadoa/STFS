# Testing UDP Firewall from WSL2 to Windows

## Quick Test

Run the UDP test script from WSL2:

```bash
node test-udp.js
```

Or specify host and port:
```bash
node test-udp.js 192.168.16.1 57120
```

## Windows Firewall Configuration

### Option 1: Allow UDP Port via PowerShell (Recommended)

Run PowerShell **as Administrator**:

```powershell
# Allow UDP on port 57120
New-NetFirewallRule -DisplayName "Allow UDP 57120 from WSL2" -Direction Inbound -Protocol UDP -LocalPort 57120 -Action Allow

# Verify the rule was created
Get-NetFirewallRule -DisplayName "Allow UDP 57120 from WSL2"
```

### Option 2: Allow via Windows Defender Firewall GUI

1. Open **Windows Defender Firewall** (search in Start menu)
2. Click **Advanced settings**
3. Click **Inbound Rules** → **New Rule**
4. Select **Port** → **Next**
5. Select **UDP** and enter port **57120** → **Next**
6. Select **Allow the connection** → **Next**
7. Check all profiles (Domain, Private, Public) → **Next**
8. Name it "Allow UDP 57120 from WSL2" → **Finish**

### Option 3: Temporarily Disable Firewall (Testing Only)

⚠️ **Warning**: Only for testing! Re-enable after testing.

```powershell
# Disable firewall temporarily
Set-NetFirewallProfile -Profile Domain,Public,Private -Enabled False

# Re-enable firewall
Set-NetFirewallProfile -Profile Domain,Public,Private -Enabled True
```

## Verify Windows Host IP

From WSL2, get the Windows host IP:

```bash
# Method 1: From default route
ip route | grep default | awk '{print $3}'

# Method 2: From resolv.conf
cat /etc/resolv.conf | grep nameserver | awk '{print $2}'
```

## Test Connectivity

1. **Ping test** (basic connectivity):
   ```bash
   ping $(ip route | grep default | awk '{print $3}')
   ```

2. **UDP test** (using the test script):
   ```bash
   node test-udp.js
   ```

3. **Check if your program is listening**:
   On Windows, verify your program is listening on `0.0.0.0:57120` (all interfaces)

## Troubleshooting

- If ping works but UDP doesn't → **Firewall issue**
- If UDP test shows "sent" but no response → **Firewall or program not listening**
- If you get "EADDRNOTAVAIL" → **Wrong IP address** (check Windows host IP)

## Common Issues

1. **Firewall blocking**: Most common issue. Use PowerShell command above.
2. **Program bound to 127.0.0.1**: Should bind to `0.0.0.0` to receive from WSL2
3. **Wrong port**: Verify both sides use the same port (57120)
4. **WSL2 networking**: Try restarting WSL2: `wsl --shutdown` then restart

