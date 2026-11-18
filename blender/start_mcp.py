# Blenderを起動したときにMCP用のサーバーを開始する
import bpy
def _go():
    try:
        bpy.ops.blendermcp.start_server()
        print("BlenderMCP start requested")
    except Exception as e:
        print("BlenderMCP start failed", e)
    return None
bpy.app.timers.register(_go, first_interval=2.0)
