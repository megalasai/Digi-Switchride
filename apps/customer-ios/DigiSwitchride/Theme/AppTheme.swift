import SwiftUI

enum AppColors {
    static let greenPrimary = Color(red: 0.09, green: 0.64, blue: 0.29)
    static let greenDark = Color(red: 0.08, green: 0.50, blue: 0.24)
    static let greenLight = Color(red: 0.86, green: 0.99, blue: 0.91)
    static let background = Color(red: 0.95, green: 0.96, blue: 0.98)
    static let textSecondary = Color(red: 0.39, green: 0.45, blue: 0.55)
    static let batteryHigh = Color(red: 0.13, green: 0.77, blue: 0.37)
    static let batteryMid = Color(red: 0.96, green: 0.62, blue: 0.04)
    static let batteryLow = Color(red: 0.94, green: 0.27, blue: 0.27)
}

extension Color {
    static func batteryColor(for percent: Int) -> Color {
        if percent >= 60 { return AppColors.batteryHigh }
        if percent >= 30 { return AppColors.batteryMid }
        return AppColors.batteryLow
    }
}

struct PrimaryButtonStyle: ButtonStyle {
    var loading = false

    func makeBody(configuration: Configuration) -> some View {
        HStack {
            if loading {
                ProgressView().tint(.white)
            } else {
                configuration.label
                    .font(.headline)
            }
        }
        .frame(maxWidth: .infinity, minHeight: 52)
        .background(AppColors.greenPrimary.opacity(configuration.isPressed ? 0.85 : 1))
        .foregroundStyle(.white)
        .clipShape(RoundedRectangle(cornerRadius: 14))
    }
}
