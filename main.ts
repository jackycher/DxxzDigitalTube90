/**
 * makecode Four Digit Display (Custom Timing) Package.
 * Adapted from Arduino manual timing code
 */

/**
 * Custom LED Display (Manual Timing)
 */
//% weight=23 color=#50A820 icon="\uf02b"
//% blockId="CUSTOM_DISPLAY" block="自定义数码管模块"
namespace CustomDisplay {
    // 段码表（与原Arduino一致：0-9 + 空）
    let _SEGMENTS = [0x3F, 0x06, 0x5B, 0x4F, 0x66, 0x6D, 0x7D, 0x07, 0x7F, 0x6F, 0x00];
    // 全局状态
    let _clkPin: DigitalPin; // 对应原Arduino引脚9（时序引脚）
    let _enablePin: DigitalPin; // 对应原Arduino引脚8（使能引脚）
    let _brightness: number = 7; // 亮度（模拟，实际通过延时调整）
    let _count: number = 4; // 数码管位数
    let _buf: Buffer; // 显示缓冲区

    /**
     * Custom LED Display Class
     */
    export class CustomLEDs {
        constructor(clk: DigitalPin, enable: DigitalPin, count: number) {
            _clkPin = clk;
            _enablePin = enable;
            _count = count < 1 || count > 4 ? 4 : count;
            _buf = pins.createBuffer(_count);
            this.init();
        }

        /**
         * 初始化引脚和时序
         */
        init(): void {
            // 初始化引脚模式
            pins.setPull(_clkPin, PinPullMode.PullNone);
            pins.setPull(_enablePin, PinPullMode.PullNone);
            pins.digitalWritePin(_clkPin, 0);
            pins.digitalWritePin(_enablePin, 1); // 使能引脚高电平（与原Arduino一致）
            
            // 发送64个bitZero初始化（与原Arduino一致）
            for (let i = 0; i < 64; i++) {
                this.bitZero();
                control.waitMicros(6);
            }
            this.clear();
        }

        /**
         * 发送0比特（原Arduino bitZero逻辑）
         */
        bitZero(): void {
            // Micro:bit无全局中断，用临界区模拟
            const irq = control.enableInterrupts(false);
            // 引脚翻转（低→高）
            pins.digitalWritePin(_clkPin, 1);
            // 4个nop（Micro:bit用waitMicros模拟，1us≈1nop）
            control.waitMicros(4);
            // 引脚翻转（高→低）
            pins.digitalWritePin(_clkPin, 0);
            // 8个nop
            control.waitMicros(8);
            control.enableInterrupts(irq);
        }

        /**
         * 发送1比特（原Arduino bitOne逻辑）
         */
        bitOne(): void {
            const irq = control.enableInterrupts(false);
            // 引脚翻转（低→高）
            pins.digitalWritePin(_clkPin, 1);
            // 8个nop
            control.waitMicros(8);
            // 引脚翻转（高→低）
            pins.digitalWritePin(_clkPin, 0);
            // 4个nop
            control.waitMicros(4);
            control.enableInterrupts(irq);
        }

        /**
         * 显示单个数字（对应原Arduino printNum）
         * @param num 要显示的数字 0-9
         * @param bit 显示位置 0-3
         */
        //% blockId="CUSTOM_showbit" block="%led|在第 %bit| 位显示数字 %num"
        //% weight=90 blockGap=8
        //% bit.min=0 bit.max=3 num.min=0 num.max=9
        showbit(bit: number = 0, num: number = 0): void {
            bit = bit % _count;
            num = num % 10; // 仅支持0-9
            _buf[bit] = _SEGMENTS[num];
            
            // 逐段发送时序（8段）
            for (let i = 0; i < 8; i++) {
                const enableSegment = (_SEGMENTS[num] >> i) & 1;
                if (enableSegment) {
                    this.bitOne();
                } else {
                    this.bitZero();
                }
                control.waitMicros(6);
            }
            control.waitMicros(10);
        }

        /**
         * 显示带小数点的单个数字（对应原Arduino printNumW）
         * @param num 要显示的数字 0-9
         * @param bit 显示位置 0-3
         */
        //% blockId="CUSTOM_showbit_with_dp" block="%led|在第 %bit| 位显示数字 %num（带小数点）"
        //% weight=89 blockGap=8
        //% bit.min=0 bit.max=3 num.min=0 num.max=9
        showbitWithDP(bit: number = 0, num: number = 0): void {
            bit = bit % _count;
            num = num % 10;
            _buf[bit] = _SEGMENTS[num] | 0x80; // 强制小数点亮
            
            for (let i = 0; i < 8; i++) {
                const enableSegment = ((_SEGMENTS[num] >> i) & 1) || (i === 7);
                if (enableSegment) {
                    this.bitOne();
                } else {
                    this.bitZero();
                }
                control.waitMicros(6);
            }
            control.waitMicros(10);
        }

        /**
         * 显示四位数字（对应原Arduino displayNumber）
         * @param num 要显示的数字 0-9999
         */
        //% blockId="CUSTOM_shownum" block="%led|显示数字 %num"
        //% weight=91 blockGap=8
        //% num.min=0 num.max=9999
        showNumber(num: number): void {
            num = num < 0 ? 0 : num > 9999 ? 9999 : num;
            // 拆分四位：千、百、十、个
            const d = num % 10;
            const c = Math.idiv(num, 10) % 10;
            const b = Math.idiv(num, 100) % 10;
            const a = Math.idiv(num, 1000) % 10;
            
            this.showbit(0, a); // 千位
            this.showbit(1, b); // 百位
            this.showbit(2, c); // 十位
            this.showbit(3, d); // 个位
        }

        /**
         * 清空显示
         */
        //% blockId="CUSTOM_clear" block="清除显示 %led"
        //% weight=80 blockGap=8
        clear(): void {
            for (let i = 0; i < _count; i++) {
                this.showbit(i, 10); // 10对应空段码
                _buf[i] = 0;
            }
        }

        /**
         * 设置亮度（模拟，通过调整时序延时）
         * @param val 亮度 1-8，0=关闭
         */
        //% blockId="CUSTOM_set_intensity" block="%led|设置亮度 %val"
        //% weight=50 blockGap=8
        //% val.min=0 val.max=8
        intensity(val: number = 7): void {
            _brightness = val < 0 ? 0 : val > 8 ? 8 : val;
            if (_brightness === 0) {
                pins.digitalWritePin(_enablePin, 0); // 关闭使能
            } else {
                pins.digitalWritePin(_enablePin, 1); // 开启使能
                // 亮度对应延时缩放（模拟亮度）
                const scale = _brightness / 8;
                // 可扩展：调整bitZero/bitOne的延时
            }
        }

        /**
         * 关闭显示
         */
        //% blockId="CUSTOM_off" block="关闭 %led"
        //% weight=85 blockGap=8
        off(): void {
            this.intensity(0);
        }

        /**
         * 打开显示
         */
        //% blockId="CUSTOM_on" block="打开 %led"
        //% weight=86 blockGap=8
        on(): void {
            this.intensity(_brightness || 7);
        }
    }

    /**
     * 创建自定义数码管实例
     * @param clk 时序引脚（对应原Arduino引脚9）
     * @param enable 使能引脚（对应原Arduino引脚8）
     * @param count 数码管位数 1-4
     */
    //% weight=200 blockGap=8
    //% blockId="CUSTOM_create" block="时序引脚 %clk|使能引脚 %enable|位数 %count"
    //% count.min=1 count.max=4
    export function create(clk: DigitalPin, enable: DigitalPin, count: number = 4): CustomLEDs {
        return new CustomLEDs(clk, enable, count);
    }
}
