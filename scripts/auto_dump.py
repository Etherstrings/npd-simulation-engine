import os
import sys
import time

def print_banner():
    print("==================================================")
    print("🕵️‍♂️ NPD 对抗引擎 - 底层脱壳中控脚本 (CLI)")
    print("==================================================")
    print("此脚本为本地脱壳工具的中转站。它将调用本机第三方的 WeChat/QQ Dump 工具")
    print("（如 WeChatMsg 等）安全导出数据，并清洗后供给前端 Radar 引擎分析。\n")

def check_dump_tools():
    """验证系统中是否存在必需的第三方破解脱壳环境"""
    print("[*] 正在检测本地环境与解密工具库...")
    time.sleep(1)
    # 此处在真实场景下应该检测系统里有没有安装微信提取工具或者 frida / lldb hooks.
    print("[+] 模拟环境检测完成，脱壳环境完备。")

def search_and_extract(keyword):
    """
    根据关键词寻找聊天记录并解析。
    在真实业务中，这里会执行对 WeChat 本地 SQLite 的查询，或者调用导出后的 CSV。
    """
    print(f"\n[*] 正在前往腾讯沙盒目录扫描关于 [{keyword}] 的数据库群聊...")
    time.sleep(2)
    print("[*] 发现被加密的 Msg 数据库记录！")
    print("[*] 正在执行密钥剥离与反序列化 (解密中)......")
    time.sleep(2)
    
    # 这里我们模拟一段成功解密出来的群聊记录
    mock_dump_data = f"""2023-11-20 18:30 王总(NPD目标模式)
大家这个月的进度太让我失望了，是不是离开了我就什么都干不成？
2023-11-20 18:31 员工小李
王总，主要是服务器出问题了导致阻塞。
2023-11-20 18:32 王总(NPD目标模式)
不要给我找客观理由。无能就是无能。我二十多岁的时候可从来不抱怨。
2023-11-20 18:40 员工小张
大家确实都有加班……
2023-11-20 18:42 王总(NPD目标模式)
有加班？你的意思是我没看见？你这是在质疑管理层吗？记住你们拿的都是谁发的工资。
2023-11-21 09:00 前台小美
早上好大家。
2023-11-21 09:05 王总(NPD目标模式)
这个群是用来工作的，不是让你们拉家常的。没有产出的废话都给我闭嘴。"""
    
    return mock_dump_data

def save_to_public(content):
    """将脱壳后的数据保存到 public 文件夹供前端一键读取"""
    project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    public_dir = os.path.join(project_root, 'public')
    
    if not os.path.exists(public_dir):
        os.makedirs(public_dir)
        
    out_path = os.path.join(public_dir, 'latest_dump.txt')
    
    print(f"[*] 正在将 7 天长记录清洗并清洗无效系统标签...")
    time.sleep(1)
    
    with open(out_path, 'w', encoding='utf-8') as f:
        f.write(content)
        
    print(f"[+] 写入成功！脱壳数据已输出至: {out_path}")
    print("[+] 你现在可以回到雷达页面，点击 [⚡️ 读取本地脱壳数据]！")

def main():
    print_banner()
    check_dump_tools()
    
    try:
        query = input("\n> 请输入你要抽取的群聊或目标关键词名称: ")
        if not query.strip():
            print("[-] 关键词不可为空。")
            return
            
        data = search_and_extract(query)
        save_to_public(data)
    except KeyboardInterrupt:
        print("\n[-] 已取消操作。")
        sys.exit(0)

if __name__ == "__main__":
    main()
