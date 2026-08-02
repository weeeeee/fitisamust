const Jimp = require('jimp');

async function analyzeAndClean() {
    try {
        const image = await Jimp.read('logo.jpg');
        
        let removedPixels = 0;
        
        // Let's assume the top-left pixel is the background color.
        // Actually, if it's a checkerboard, it will have multiple colors.
        // We will scan for pixels that are very light (R>200, G>200, B>200) and turn them transparent.
        
        image.scan(0, 0, image.bitmap.width, image.bitmap.height, function(x, y, idx) {
            const red = this.bitmap.data[idx + 0];
            const green = this.bitmap.data[idx + 1];
            const blue = this.bitmap.data[idx + 2];
            
            // If the pixel is very light (white or light grey of checkerboard), make it transparent
            // Let's check for R > 220, G > 220, B > 220
            if (red > 220 && green > 220 && blue > 220) {
                this.bitmap.data[idx + 3] = 0; // Alpha to 0
                removedPixels++;
            }
        });
        
        console.log(`Removed ${removedPixels} pixels.`);
        await image.writeAsync('logo_transparent.png');
        console.log('Saved as logo_transparent.png');
    } catch (e) {
        console.error(e);
    }
}

analyzeAndClean();
