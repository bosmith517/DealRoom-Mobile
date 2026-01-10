const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

function withStripBitcode(config) {
  return withDangerousMod(config, [
    'ios',
    async (config) => {
      const podfilePath = path.join(config.modRequest.platformProjectRoot, 'Podfile');

      if (fs.existsSync(podfilePath)) {
        let podfileContent = fs.readFileSync(podfilePath, 'utf8');

        const bitcodeStripScript = `
  # Strip bitcode from Mapbox frameworks (required for App Store submission)
  bitcode_strip_path = \`xcrun --find bitcode_strip\`.chomp

  def strip_bitcode_from_framework(bitcode_strip_path, framework_path)
    if File.exist?(framework_path)
      command = "#{bitcode_strip_path} \\"#{framework_path}\\" -r -o \\"#{framework_path}\\""
      puts "Stripping bitcode from: #{framework_path}"
      system(command)
    end
  end

  # Find and strip bitcode from all Mapbox frameworks
  mapbox_frameworks = Dir.glob("Pods/**/*.framework/**/Mapbox*").select { |f| File.file?(f) && !f.end_with?('.h', '.modulemap', '.plist') }
  mapbox_frameworks.each do |framework_binary|
    strip_bitcode_from_framework(bitcode_strip_path, framework_binary)
  end
`;

        // Check if we already added this
        if (!podfileContent.includes('Strip bitcode from Mapbox')) {
          // Find the post_install block and add our script
          if (podfileContent.includes('post_install do |installer|')) {
            podfileContent = podfileContent.replace(
              /post_install do \|installer\|/,
              `post_install do |installer|${bitcodeStripScript}`
            );
          } else {
            // Add post_install block at the end
            podfileContent += `\npost_install do |installer|${bitcodeStripScript}\nend\n`;
          }

          fs.writeFileSync(podfilePath, podfileContent);
          console.log('Added bitcode stripping to Podfile');
        }
      }

      return config;
    },
  ]);
}

module.exports = withStripBitcode;
